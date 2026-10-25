using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 26_000_000);
builder.Services.AddHttpClient("analytics", c => { c.BaseAddress = new Uri(Environment.GetEnvironmentVariable("ANALYTICS_URL") ?? "http://127.0.0.1:8091/"); c.Timeout = TimeSpan.FromSeconds(30); });
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(5), QueueLimit = 0 }));
});
var state = new State(Environment.GetEnvironmentVariable("DATA_DIR") ?? "./data");
var sessions = new ConcurrentDictionary<string, LoginSession>();
var challenges = new ConcurrentDictionary<string, Challenge>();
var showTotpKeyOnLogin = string.Equals(Environment.GetEnvironmentVariable("TEMP_SHOW_TOTP_KEY_ON_LOGIN"), "true", StringComparison.OrdinalIgnoreCase);
var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.tile.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    var path = context.Request.Path.Value ?? "";
    if (path.StartsWith("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        if (context.Request.Method is not ("GET" or "HEAD"))
        {
            if (context.Request.Headers["X-Requested-With"] != "RT" || context.Request.Headers["Sec-Fetch-Site"] == "cross-site") { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { message = "Недопустимый источник запроса" }); return; }
        }
        if (!path.StartsWith("/api/auth/login") && !path.StartsWith("/api/auth/verify") && path != "/api/health")
        {
            if (!context.Request.Cookies.TryGetValue("rt_session", out var token) || !sessions.TryGetValue(token, out var session) || session.Expires < DateTimeOffset.UtcNow)
            {
                context.Response.StatusCode = 401; await context.Response.WriteAsJsonAsync(new { message = "Войдите в систему" }); return;
            }
            context.Items["user"] = session.User;
        }
    }
    // Bound expired authentication state without a background job.
    foreach (var pair in sessions.Where(p => p.Value.Expires < DateTimeOffset.UtcNow)) sessions.TryRemove(pair.Key, out _);
    foreach (var pair in challenges.Where(p => p.Value.Expires < DateTimeOffset.UtcNow)) challenges.TryRemove(pair.Key, out _);
    await next();
});
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/api/health", async (IHttpClientFactory factory) =>
{
    try { var r = await factory.CreateClient("analytics").GetAsync("health"); return Results.Json(new { status = r.IsSuccessStatusCode ? "ok" : "degraded", gateway = "ok", analytics = r.IsSuccessStatusCode ? "ok" : "error" }, statusCode: r.IsSuccessStatusCode ? 200 : 503); }
    catch (HttpRequestException) { return Results.Json(new { status = "degraded", gateway = "ok", analytics = "unavailable" }, statusCode: 503); }
});
app.MapPost("/api/auth/login", (Login request) =>
{
    if (request.Username?.Length > 100 || request.Password?.Length > 500) return Results.BadRequest(new { message = "Некорректные данные входа" });
    if (request.Username != state.User.Username || !State.CheckPassword(request.Password ?? "", state.User.PasswordHash)) return Results.Json(new { message = "Неверное имя пользователя или пароль" }, statusCode: 401);
    var id = State.Token();
    challenges[id] = new Challenge(state.User.Username, DateTimeOffset.UtcNow.AddMinutes(5));
    var includeKey = !state.User.TotpEnabled || showTotpKeyOnLogin;
    return Results.Ok(new { challenge = id, setup = !state.User.TotpEnabled, secret = includeKey ? state.User.TotpSecret : null, uri = !state.User.TotpEnabled ? $"otpauth://totp/Rostelecom:{Uri.EscapeDataString(state.User.Username)}?secret={state.User.TotpSecret}&issuer=Rostelecom&digits=6&period=30" : null });
}).RequireRateLimiting("login");
app.MapPost("/api/auth/verify", (Verification request, HttpContext context) =>
{
    if (!challenges.TryGetValue(request.Challenge ?? "", out var challenge) || challenge.Expires < DateTimeOffset.UtcNow) return Results.BadRequest(new { message = "Время входа истекло. Введите пароль снова." });
    lock (state.Sync)
    {
        challenge.Attempts++;
        if (challenge.Attempts > 5) { challenges.TryRemove(request.Challenge!, out _); return Results.Json(new { message = "Превышено число попыток. Войдите снова." }, statusCode: 429); }
        var counter = State.CheckTotp(state.User.TotpSecret, request.Code ?? "");
        if (counter < 0 || counter <= state.User.LastCounter) return Results.Json(new { message = "Код неверен или уже использован. Дождитесь нового кода." }, statusCode: 401);
        state.User.LastCounter = counter;
        state.User.TotpEnabled = true;
        state.SaveUser();
        challenges.TryRemove(request.Challenge!, out _);
        var token = State.Token();
        sessions[token] = new LoginSession(challenge.User, DateTimeOffset.UtcNow.AddHours(8));
        context.Response.Cookies.Append("rt_session", token, new CookieOptions { HttpOnly = true, Secure = context.Request.IsHttps, SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromHours(8), Path = "/" });
        return Results.Ok(new { username = challenge.User });
    }
}).RequireRateLimiting("login");
app.MapGet("/api/auth/me", (HttpContext c) => new { username = c.Items["user"], twoFactor = true });
app.MapPost("/api/auth/totp-key", (PasswordConfirmation request, HttpContext context) =>
{
    if (request.Password is null || request.Password.Length > 500 ||
        context.Items["user"]?.ToString() != state.User.Username ||
        !State.CheckPassword(request.Password, state.User.PasswordHash))
        return Results.Json(new { message = "Неверный пароль" }, statusCode: 403);
    return Results.Ok(new { secret = state.User.TotpSecret });
}).RequireRateLimiting("login");
app.MapPost("/api/auth/logout", (HttpContext context) =>
{
    if (context.Request.Cookies.TryGetValue("rt_session", out var token)) sessions.TryRemove(token, out _);
    context.Response.Cookies.Delete("rt_session");
    return Results.Ok();
});
app.MapGet("/api/subscriptions", () => { lock (state.Sync) return Results.Ok(state.Subscriptions.ToArray()); });
app.MapPost("/api/subscriptions", async (SubscriptionInput input, IHttpClientFactory factory) =>
{
    if (input.Region?.Length > 100 || input.Industry?.Length > 100 || input.Need?.Length > 100 || input.Stage?.Length > 100) return Results.BadRequest(new { message = "Некорректные фильтры" });
    try
    {
        var projects = await factory.CreateClient("analytics").GetFromJsonAsync<JsonElement[]>("projects") ?? [];
        lock (state.Sync)
        {
            if (state.Subscriptions.Count >= 50) return Results.BadRequest(new { message = "Максимум 50 подписок" });
            if (state.Subscriptions.Any(s => s.Region == (input.Region ?? "") && s.Industry == (input.Industry ?? "") && s.Need == (input.Need ?? "") && s.Stage == (input.Stage ?? ""))) return Results.Conflict(new { message = "Такая подписка уже существует" });
            var sub = new Subscription { Id = State.Token(), Region = input.Region ?? "", Industry = input.Industry ?? "", Need = input.Need ?? "", Stage = input.Stage ?? "", CreatedAt = DateTimeOffset.UtcNow, Seen = projects.Select(p => p.GetProperty("id").GetString()!).ToList() };
            state.Subscriptions.Add(sub); state.SaveSubscriptions();
            return Results.Ok(sub);
        }
    }
    catch (HttpRequestException) { return Results.Json(new { message = "Сервис проектов недоступен" }, statusCode: 503); }
});
app.MapDelete("/api/subscriptions/{id}", (string id) => { lock (state.Sync) { state.Subscriptions.RemoveAll(s => s.Id == id); state.SaveSubscriptions(); return Results.NoContent(); } });
app.MapGet("/api/notifications", async (IHttpClientFactory factory) =>
{
    try
    {
        var projects = await factory.CreateClient("analytics").GetFromJsonAsync<JsonElement[]>("projects") ?? [];
        lock (state.Sync)
        {
            var matching = projects.Where(p => state.Subscriptions.Any(s => s.Matches(p) && !s.Seen.Contains(p.GetProperty("id").GetString()!))).ToArray();
            return Results.Ok(matching);
        }
    }
    catch (HttpRequestException) { return Results.Json(new { message = "Сервис проектов недоступен" }, statusCode: 503); }
});
app.MapPost("/api/notifications/read", async (IHttpClientFactory factory) =>
{
    try
    {
        var projects = await factory.CreateClient("analytics").GetFromJsonAsync<JsonElement[]>("projects") ?? [];
        lock (state.Sync) { foreach (var s in state.Subscriptions) s.Seen = s.Seen.Union(projects.Where(s.Matches).Select(p => p.GetProperty("id").GetString()!)).ToList(); state.SaveSubscriptions(); }
        return Results.Ok();
    }
    catch (HttpRequestException) { return Results.Json(new { message = "Сервис проектов недоступен" }, statusCode: 503); }
});
// Deliberate allowlist: internal Python docs and arbitrary paths are not published.
app.MapMethods("/api/{**path}", ["GET", "POST"], async (string path, HttpContext context, IHttpClientFactory factory) =>
{
    var getAllowed = new[] { "catalog", "companies", "projects", "insights", "data-status", "registry-status", "pricing-catalog", "export/companies", "export/projects", "export/deals", "template/companies", "template/projects", "template/deals", "template/sites" };
    var postAllowed = new[] { "estimate", "estimate/export/csv", "estimate/export/docx", "estimate/export/doc", "import/companies", "import/projects", "import/deals", "source-import/clients", "source-import/fns", "source-import/sites", "source-import/facts" };
    if (!(context.Request.Method == "GET" ? getAllowed : postAllowed).Contains(path)) { context.Response.StatusCode = 404; return; }
    using var message = new HttpRequestMessage(new HttpMethod(context.Request.Method), path + context.Request.QueryString);
    if (context.Request.Method == "POST")
    {
        message.Content = new StreamContent(context.Request.Body);
        message.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(context.Request.ContentType ?? "application/json");
    }
    try
    {
        using var response = await factory.CreateClient("analytics").SendAsync(message, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);
        context.Response.StatusCode = (int)response.StatusCode;
        context.Response.ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
        if (response.Content.Headers.ContentDisposition is not null) context.Response.Headers.ContentDisposition = response.Content.Headers.ContentDisposition.ToString();
        await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
    {
        if (!context.Response.HasStarted) { context.Response.StatusCode = 503; await context.Response.WriteAsJsonAsync(new { message = "Аналитический сервис временно недоступен" }); }
    }
});
app.MapFallbackToFile("index.html");
app.Run();

record Login(string? Username, string? Password);
record PasswordConfirmation(string? Password);
record Verification(string? Challenge, string? Code);
record LoginSession(string User, DateTimeOffset Expires);
sealed class Challenge(string user, DateTimeOffset expires) { public string User = user; public DateTimeOffset Expires = expires; public int Attempts; }
record SubscriptionInput(string? Region, string? Industry, string? Need, string? Stage);
sealed class UserRecord { public string Username { get; set; } = ""; public string PasswordHash { get; set; } = ""; public string TotpSecret { get; set; } = ""; public bool TotpEnabled { get; set; } public long LastCounter { get; set; } = -1; }
sealed class Subscription
{
    public string Id { get; set; } = ""; public string Region { get; set; } = ""; public string Industry { get; set; } = ""; public string Need { get; set; } = ""; public string Stage { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; }
    public List<string> Seen { get; set; } = [];
    public bool Matches(JsonElement p) => (Region == "" || p.GetProperty("region").GetString() == Region) && (Industry == "" || p.GetProperty("industry").GetString() == Industry) && (Need == "" || p.GetProperty("need").GetString() == Need) && (Stage == "" || p.GetProperty("stage").GetString() == Stage);
}
sealed class State
{
    public object Sync { get; } = new();
    public UserRecord User { get; }
    public List<Subscription> Subscriptions { get; }
    readonly string directory;
    public State(string dir)
    {
        directory = dir; Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, "user.json");
        if (File.Exists(file)) User = JsonSerializer.Deserialize<UserRecord>(File.ReadAllText(file))!;
        else
        {
            var password = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
            if (string.IsNullOrEmpty(password) || password.Length < 12) throw new InvalidOperationException("Set ADMIN_PASSWORD to at least 12 characters for the first launch.");
            User = new UserRecord { Username = Environment.GetEnvironmentVariable("ADMIN_USER") ?? "admin", PasswordHash = HashPassword(password), TotpSecret = Base32(RandomNumberGenerator.GetBytes(20)) };
            SaveUser();
        }
        var subscriptionsFile = Path.Combine(dir, "subscriptions.json");
        Subscriptions = File.Exists(subscriptionsFile) ? JsonSerializer.Deserialize<List<Subscription>>(File.ReadAllText(subscriptionsFile))! : [];
    }
    void Write(string file, object value)
    {
        var target = Path.Combine(directory, file);
        File.WriteAllText(target + ".tmp", JsonSerializer.Serialize(value));
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(target + ".tmp", UnixFileMode.UserRead | UnixFileMode.UserWrite);
        File.Move(target + ".tmp", target, true);
    }
    public void SaveUser() => Write("user.json", User);
    public void SaveSubscriptions() => Write("subscriptions.json", Subscriptions);
    public static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        return Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(Rfc2898DeriveBytes.Pbkdf2(password, salt, 210000, HashAlgorithmName.SHA256, 32));
    }
    public static bool CheckPassword(string password, string hash)
    {
        var parts = hash.Split(':');
        return CryptographicOperations.FixedTimeEquals(Convert.FromBase64String(parts[1]), Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(parts[0]), 210000, HashAlgorithmName.SHA256, 32));
    }
    static string Base32(byte[] bytes)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var bits = string.Concat(bytes.Select(b => Convert.ToString(b, 2).PadLeft(8, '0')));
        return string.Concat(Enumerable.Range(0, bits.Length / 5).Select(i => alphabet[Convert.ToInt32(bits.Substring(i * 5, 5), 2)]));
    }
    public static long CheckTotp(string secret, string code)
    {
        if (code.Length != 6 || !code.All(char.IsAsciiDigit)) return -1;
        var bits = string.Concat(secret.Select(c => Convert.ToString("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".IndexOf(c), 2).PadLeft(5, '0')));
        var key = Enumerable.Range(0, bits.Length / 8).Select(i => Convert.ToByte(bits.Substring(i * 8, 8), 2)).ToArray();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        for (var i = -1; i <= 1; i++)
        {
            var bytes = BitConverter.GetBytes(now + i); if (BitConverter.IsLittleEndian) Array.Reverse(bytes);
            var hash = HMACSHA1.HashData(key, bytes); var offset = hash[^1] & 15;
            var value = ((hash[offset] & 127) << 24 | hash[offset + 1] << 16 | hash[offset + 2] << 8 | hash[offset + 3]) % 1000000;
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(value.ToString("D6")), Encoding.ASCII.GetBytes(code))) return now + i;
        }
        return -1;
    }
}
