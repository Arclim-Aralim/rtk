param([switch]$Rebuild, [switch]$AllowFreshData)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
if (!(Test-Path "$root/data/analytics/analytics.sqlite3") -and !$AllowFreshData) {
    throw 'Server database missing. Copy data, imports and .env from the server first, or use -AllowFreshData for a separate new local database.'
}
foreach ($dir in @('run','logs','data/analytics','data/gateway')) { New-Item -ItemType Directory -Force "$root/$dir" | Out-Null }
$python = "$root/.venv/Scripts/python.exe"
if (!(Test-Path $python)) { throw 'Run scripts/setup-local.ps1 first.' }
foreach ($port in @(8080,8091)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is busy. Stop the running instance first." }
}
if ($Rebuild -or !(Test-Path "$root/runtime/windows/Gateway.exe")) {
    Push-Location "$root/frontend"
    try { & pnpm.cmd build; if ($LASTEXITCODE) { throw 'Frontend build failed' } } finally { Pop-Location }
    & dotnet publish "$root/services/gateway/Gateway.csproj" -c Release --no-self-contained -o "$root/runtime/windows"
    if ($LASTEXITCODE) { throw 'Gateway build failed' }
    New-Item -ItemType Directory -Force "$root/runtime/windows/wwwroot" | Out-Null
    Copy-Item "$root/frontend/dist/*" "$root/runtime/windows/wwwroot" -Recurse -Force
}
if (!(Test-Path "$root/.env")) {
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    @('ADMIN_USER=admin', ('ADMIN_PASSWORD=' + [Convert]::ToBase64String($bytes))) | Set-Content "$root/.env" -Encoding utf8
}
Get-Content "$root/.env" | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"').Trim("'"), 'Process')
    }
}
$started = @()
try {
    $env:DATA_DIR = "$root/data/analytics"
    $analytics = Start-Process -FilePath $python -ArgumentList @('-m','uvicorn','main:app','--app-dir',"`"$root/services/analytics`"",'--host','127.0.0.1','--port','8091') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$root/logs/analytics-local.log" -RedirectStandardError "$root/logs/analytics-local.err.log" -PassThru
    $started += $analytics
    $analytics.Id | Set-Content "$root/run/analytics-local.pid"
    $env:DATA_DIR = "$root/data/gateway"
    $env:ANALYTICS_URL = 'http://127.0.0.1:8091/'
    $env:ASPNETCORE_URLS = 'http://127.0.0.1:8080'
    $gateway = Start-Process -FilePath "$root/runtime/windows/Gateway.exe" -WorkingDirectory "$root/runtime/windows" -WindowStyle Hidden -RedirectStandardOutput "$root/logs/gateway-local.log" -RedirectStandardError "$root/logs/gateway-local.err.log" -PassThru
    $started += $gateway
    $gateway.Id | Set-Content "$root/run/gateway-local.pid"
    $ready = $false
    for ($i=0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        try { $health = Invoke-RestMethod 'http://127.0.0.1:8080/api/health'; if ($health.status -eq 'ok') { $ready = $true; break } } catch { }
        if ($analytics.HasExited -or $gateway.HasExited) { break }
    }
    if (!$ready) { throw 'Local services failed. Check logs/*local*.log.' }
    Write-Host 'Application: http://localhost:8080'
    Write-Host 'Initial credentials: .env. Existing server account keeps its password and TOTP.'
} catch {
    foreach ($process in $started) { if (!$process.HasExited) { Stop-Process -Id $process.Id -Force } }
    throw
}
