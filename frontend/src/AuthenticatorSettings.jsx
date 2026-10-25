import { useEffect, useRef, useState } from "react";
import { LoaderCircle, ShieldCheck, X } from "lucide-react";
import { api } from "./api";
import { ui } from "./ui";

export default function AuthenticatorSettings({ close }) {
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const controller = useRef(null);
  const previousFocus = useRef(document.activeElement);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = dialog.current?.querySelectorAll("button:not(:disabled), input:not(:disabled)");
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        controller.current?.abort();
        setPassword(""); setSecret(""); setBusy(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      controller.current?.abort();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      document.body.style.overflow = overflow;
      previousFocus.current?.focus();
    };
  }, []);
  useEffect(() => {
    if (!secret) return;
    const timer = setTimeout(() => setSecret(""), 60_000);
    return () => clearTimeout(timer);
  }, [secret]);

  async function reveal(event) {
    event.preventDefault();
    setBusy(true); setError("");
    controller.current = new AbortController();
    try {
      const result = await api("auth/totp-key", {
        method: "POST", body: JSON.stringify({ password }), signal: controller.current.signal,
      });
      if (!document.hidden && !controller.current.signal.aborted) setSecret(result.secret);
    } catch (reason) {
      if (reason.name !== "AbortError") setError(reason.message);
    } finally {
      setPassword(""); setBusy(false);
    }
  }

  return (
    <div className={ui("modal-backdrop")} onClick={close}>
      <section className={ui("drawer")} role="dialog" aria-modal="true"
        aria-labelledby="authenticator-title" ref={dialog} tabIndex={-1}
        onClick={(event) => event.stopPropagation()}>
        <div className={ui("panel-head")}>
          <h2 id="authenticator-title">Аутентификатор</h2>
          <button className={ui("icon-button")} aria-label="Закрыть настройки аутентификатора" onClick={close}>
            <X size={21} />
          </button>
        </div>
        <div className={ui("drawer-body")}>
          <p className={ui("muted")}>Здесь можно повторно посмотреть ключ настройки и добавить этот аккаунт в приложение-аутентификатор.</p>
          {secret ? (
            <>
              <div className={ui("setup-box")}>
                <b>Ключ настройки аутентификатора</b>
                <code aria-label="Ключ настройки">{secret}</code>
                <p>В приложении выберите «Ввести ключ настройки», укажите тип «По времени» и вставьте ключ.</p>
                <small>Не передавайте ключ другим людям. Он скроется через минуту или при переключении приложения.</small>
              </div>
              <button className={ui("button")} onClick={() => setSecret("")}>Скрыть ключ</button>
            </>
          ) : (
            <form className="flex flex-col gap-5 min-w-0" onSubmit={reveal}>
              <label className={ui("field")}>
                <span>Подтвердите пароль аккаунта</span>
                <input type="password" autoComplete="current-password" value={password}
                  onChange={(event) => setPassword(event.target.value)} required maxLength={500} disabled={busy} />
              </label>
              {error && <div className={ui("error")} role="alert">{error}</div>}
              <button className={ui("button primary")} disabled={busy || !password}>
                {busy ? <LoaderCircle size={16} className={ui("spin")} /> : <ShieldCheck size={16} />}
                Показать ключ
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
