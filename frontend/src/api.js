export const initialFilters = {
  region: "Ростовская область",
  industry: "",
  q: "",
  stage: "",
  need: "",
  client: "",
  minRevenue: "",
  minGrowth: "",
  demo: "false",
  bounds: "",
  registryStatus: "current",
  locationMode: "registration",
  crossLocation: "",
  siteConfidence: "confirmed",
};
export function qs(filters) {
  return new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== "" && v != null),
  ).toString();
}
export async function api(path, options = {}) {
  const response = await fetch("/api/" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "RT",
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "Не удалось выполнить запрос";
    try {
      const e = await response.json();
      message =
        typeof e.detail === "string"
          ? e.detail
          : (e.message ??
            (Array.isArray(e.detail)
              ? e.detail.map((d) => d.msg).join("; ")
              : message));
    } catch {
      message = `Ошибка сервера (${response.status})`;
    }
    if (response.status === 401 && !path.startsWith("auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(message);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}
export async function download(path, filename, input) {
  const response = await fetch("/api/" + path, {
    method: input ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Requested-With": "RT" },
    body: input ? JSON.stringify(input) : undefined,
  });
  if (!response.ok) {
    let message = "Не удалось скачать файл";
    try {
      const e = await response.json();
      message =
        e.message ?? (typeof e.detail === "string" ? e.detail : message);
    } catch {}
    throw new Error(message);
  }
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const money = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
export const compact = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("ru-RU", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
export const date = (s) =>
  !s
    ? "Дата не указана"
    : /^\d{4}$/.test(s)
      ? `${s} год (план)`
      : new Date(s + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
