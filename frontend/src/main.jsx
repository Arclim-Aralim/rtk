import { ui, documentClasses } from "./ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Database,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import MapView from "./Map";
import { RegistryFilters, RegistryImport, CompanyRegistry } from "./Registry";
import PricingPicker from "./PricingPicker";
import AuthenticatorSettings from "./AuthenticatorSettings";
import { api, download, qs, money, compact, date, initialFilters } from "./api";
import "./styles.css";
const pages = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "radar", label: "Радар присутствия", icon: Radar },
  { id: "projects", label: "Инвестиционный навигатор", icon: Compass },
  { id: "calculator", label: "Калькулятор сделок", icon: Calculator },
  { id: "data", label: "Данные и источники", icon: Database },
];
const defaultEstimate = {
  type: "ИТ-инфраструктура",
  region: "Ростовская область",
  units: 50,
  months: 6,
  financing: "Единовременно",
  equipment: 1400000,
  software: 350000,
  labor: 500000,
  urgent: false,
  unique: false,
  customer: "",
};
function IconButton({ children, label, onClick }) {
  return (
    <button
      className={ui("icon-button")}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className={ui("field")}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Select({ value, onChange, options, all, disabled }) {
  return (
    <span className={ui("select-wrap")}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {all && <option value="">{all}</option>}
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={14} />
    </span>
  );
}
function Empty({ text = "Ничего не найдено. Попробуйте изменить фильтры." }) {
  return (
    <div className={ui("empty")}>
      <Search size={25} />
      <p>{text}</p>
    </div>
  );
}
function Source({ record }) {
  return (
    <span className={ui("source")}>
      {record.demo ? "Демо · " : ""}
      {record.sourceUrl ? (
        <a href={record.sourceUrl} target="_blank" rel="noreferrer">
          {record.source} ↗
        </a>
      ) : (
        record.source
      )}
    </span>
  );
}
function Badge({ children, tone = "purple" }) {
  return <span className={ui(`badge ${tone}`)}>{children}</span>;
}
function Login({ onLogin }) {
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [step, setStep] = useState(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (step) {
        await api("auth/verify", {
          method: "POST",
          body: JSON.stringify({ challenge: step.challenge, code }),
        });
        onLogin();
      } else
        setStep(
          await api("auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
          }),
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={ui("login-page")}>
      <div className={ui("login-brand")}>
        <img src="/logo.png" alt="Ростелеком" />
        <div>
          <span className={ui("eyebrow")}>КОММЕРЧЕСКАЯ ЭКОСИСТЕМА</span>
          <h1>
            Возможности
            <br />
            начинаются
            <br />
            <em>с данных</em>
          </h1>
          <p>
            Геоаналитика, инвестиционные проекты
            <br />и точная оценка сделок в одном пространстве.
          </p>
        </div>
        <span className={ui("login-caption")}>Технологии возможностей</span>
      </div>
      <div className={ui("login-main")}>
        <form onSubmit={submit} className={ui("login-form")}>
          <div className={ui("login-symbol")}>
            <ShieldCheck size={27} />
          </div>
          <h2>{step ? "Подтвердите вход" : "Вход в экосистему"}</h2>
          <p className={ui("muted")}>
            {step
              ? step.setup
                ? "Подключите приложение-аутентификатор при первом входе."
                : "Введите одноразовый код из приложения-аутентификатора."
              : "Используйте учётную запись коммерческого блока."}
          </p>
          {!step ? (
            <>
              <Field label="Имя пользователя">
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={100}
                />
              </Field>
              <Field label="Пароль">
                <span className={ui("password-wrap")}>
                  <input
                    type={visible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    maxLength={500}
                  />
                  <button
                    type="button"
                    aria-label="Показать или скрыть пароль"
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </Field>
            </>
          ) : (
            <>
              {step.secret && (
                <div className={ui("setup-box")}>
                  <b>{step.setup ? "1. Добавьте ключ в аутентификатор" : "Ключ настройки аутентификатора"}</b>
                  <p>
                    Выберите «Ввести ключ настройки», укажите тип «По времени» и
                    сохраните этот ключ.
                  </p>
                  <code>{step.secret}</code>
                  <small>
                    Сохраните ключ в безопасном месте для восстановления
                    доступа.
                  </small>
                </div>
              )}
              <Field
                label={
                  step.setup
                    ? "2. Введите шестизначный код"
                    : "Код подтверждения"
                }
              >
                <input
                  className={ui("otp")}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  autoFocus={!step.secret}
                />
              </Field>
            </>
          )}
          {error && (
            <div className={ui("error")} role="alert">
              {error}
            </div>
          )}
          <button className={ui("button primary wide")} disabled={busy}>
            {busy ? (
              <LoaderCircle size={18} className={ui("spin")} />
            ) : (
              <>
                {step ? "Подтвердить" : "Продолжить"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          {step && (
            <button
              type="button"
              className={ui("text-button")}
              onClick={() => {
                setStep(null);
                setCode("");
                setError("");
              }}
            >
              Вернуться ко входу
            </button>
          )}
          <div className={ui("login-security")}>
            <ShieldCheck size={15} /> Двухфакторная аутентификация
          </div>
        </form>
      </div>
    </main>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true),
    [page, setPage] = useState(() =>
      pages.some((p) => p.id === location.hash.slice(1))
        ? location.hash.slice(1)
        : "overview",
    ),
    [mobile, setMobile] = useState(false),
    [filters, setFilters] = useState(initialFilters),
    [catalog, setCatalog] = useState({
      regions: [],
      industries: [],
      stages: [],
      needs: [],
    }),
    [companies, setCompanies] = useState([]),
    [projects, setProjects] = useState([]),
    [insights, setInsights] = useState(null),
    [selected, setSelected] = useState(),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState(""),
    [subscriptionOpen, setSubscriptionOpen] = useState(false),
    [authenticatorOpen, setAuthenticatorOpen] = useState(false),
    [notifications, setNotifications] = useState([]),
    [estimateInput, setEstimateInput] = useState(defaultEstimate);
  const toastTimer = useRef(undefined);
  function notify(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  }
  const check = useCallback(async () => {
    try {
      const me = await api("auth/me");
      setUser(me.username);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    check();
    const expired = () => { setUser(null); setAuthenticatorOpen(false); };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [check]);
  useEffect(() => {
    const handler = () => {
      const p = location.hash.slice(1);
      if (pages.some((v) => v.id === p)) setPage(p);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!user) return;
    let current = true;
    api("catalog")
      .then((c) => {
        if (current) setCatalog(c);
      })
      .catch((e) => setError(e.message));
    return () => {
      current = false;
    };
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let current = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const companyFilters = {
        registryStatus: filters.registryStatus,
        locationMode: filters.locationMode,
        crossLocation: filters.crossLocation,
        siteConfidence: filters.siteConfidence,
        region: filters.region,
        industry: filters.industry,
        q: filters.q,
        client: filters.client,
        minRevenue: filters.minRevenue,
        minGrowth: filters.minGrowth,
        demo: filters.demo,
        bounds: filters.bounds,
      };
      const projectFilters = {
        region: filters.region,
        industry: filters.industry,
        q: filters.q,
        stage: filters.stage,
        need: filters.need,
        demo: filters.demo,
        bounds: filters.bounds,
      };
      Promise.all([
        api("companies?" + qs(companyFilters)),
        api("projects?" + qs(projectFilters)),
        api("insights?" + qs(companyFilters)),
      ])
        .then(([c, p, i]) => {
          if (current) {
            setCompanies(c);
            setProjects(p);
            setInsights(i);
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [user, filters, revision]);
  useEffect(() => {
    if (!user) return;
    const poll = () =>
      api("notifications")
        .then(setNotifications)
        .catch(() => {});
    poll();
    const timer = setInterval(poll, 60000);
    return () => clearInterval(timer);
  }, [user, revision]);
  function navigate(p) {
    window.scrollTo({ top: 0, behavior: "instant" });
    setPage(p);
    location.hash = p;
    setMobile(false);
    setFilters((f) => ({ ...f, q: "" }));
    setSelected(undefined);
  }
  function filter(key, value) {
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === "region" ? { bounds: "" } : {}),
    }));
    setSelected(undefined);
  }
  async function saveFile(path, name, body) {
    try {
      await download(path, name, body);
      notify("Файл подготовлен для скачивания");
    } catch (e) {
      notify(e.message);
    }
  }
  function toCalculator(project) {
    setEstimateInput({
      ...defaultEstimate,
      type: project.need,
      region: project.region,
      customer: project.initiator,
    });
    navigate("calculator");
  }
  const activeCompany = companies.find((c) => c.id === selected),
    activeProject = projects.find((c) => c.id === selected);
  if (checking)
    return (
      <div className={ui("app-loading")}>
        <LoaderCircle className={ui("spin")} /> Загрузка экосистемы
      </div>
    );
  if (!user) return <Login onLogin={check} />;
  return (
    <div className={ui("app-shell")}>
      <aside className={ui(`sidebar ${mobile ? "open" : ""}`)}>
        <a
          href="#overview"
          className={ui("brand")}
          onClick={() => navigate("overview")}
        >
          <img src="/logo.png" alt="Ростелеком" />
        </a>
        <div className={ui("workspace-label")}>
          Коммерческий блок<span>Аналитическая экосистема</span>
        </div>
        <nav aria-label="Основная навигация">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={ui(page === id ? "active" : "")}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {page === id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className={ui("sidebar-bottom")}>
          <div className={ui("environment")}>
            <span /> Рабочее пространство
          </div>
          <div className={ui("user-block")}>
            <span className={ui("avatar")}>
              {user.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{user}</b>
              <small>Коммерческий аналитик</small>
            </div>
            <IconButton
              label="Выйти"
              onClick={async () => {
                try {
                  await api("auth/logout", { method: "POST" });
                  setAuthenticatorOpen(false);
                  setUser(null);
                } catch (e) {
                  notify(e.message);
                }
              }}
            >
              <LogOut size={17} />
            </IconButton>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Закрыть навигацию"
          className={ui("mobile-overlay")}
          onClick={() => setMobile(false)}
        />
      )}
      <div className={ui("main-shell")}>
        <header className={ui("topbar")}>
          <div className={ui("topbar-left")}>
            <span className={ui("mobile-menu")}>
              <IconButton
                label="Открыть навигацию"
                onClick={() => setMobile(!mobile)}
              >
                <Menu size={21} />
              </IconButton>
            </span>
            <span>Экосистема</span>
            <ChevronRight size={13} />
            <b>{pages.find((p) => p.id === page)?.label}</b>
          </div>
          <div className={ui("topbar-actions")}>
            <span className={ui("date-label")}>
              {new Date().toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className={ui("notification-button")}
              aria-label={`Подписки и уведомления: ${notifications.length}`}
              onClick={() => setSubscriptionOpen(true)}
            >
              <Bell size={19} />
              {notifications.length > 0 && <span>{notifications.length}</span>}
            </button>
            <button className={ui("secure-label")} title="Ключ аутентификатора"
              aria-label="Настройки аутентификатора — показать ключ" onClick={() => setAuthenticatorOpen(true)}>
              <ShieldCheck size={16} />
              2FA
            </button>
          </div>
        </header>
        <main className={ui("content")}>
          <div className={ui("page-title")}>
            <div>
              <span className={ui("eyebrow")}>
                {page === "overview"
                  ? "ДАННЫЕ. РЕШЕНИЯ. РОСТ."
                  : page === "radar"
                    ? "ГЕОАНАЛИТИКА"
                    : page === "projects"
                      ? "ИНВЕСТИЦИОННАЯ АКТИВНОСТЬ"
                      : page === "calculator"
                        ? "ОЦЕНКА СТОИМОСТИ"
                        : "УПРАВЛЕНИЕ ДАННЫМИ"}
              </span>
              <h1>
                {page === "overview"
                  ? "Точки роста вашего бизнеса"
                  : pages.find((p) => p.id === page)?.label}
              </h1>
              <p>
                {page === "overview"
                  ? "Находите перспективных клиентов и превращайте данные в возможности."
                  : page === "radar"
                    ? "Оцените присутствие и найдите незанятые рыночные ниши."
                    : page === "projects"
                      ? "Следите за проектами и выходите к заказчику в нужный момент."
                      : page === "calculator"
                        ? "Рассчитайте ценовой диапазон и подготовьте коммерческое предложение."
                        : "Загружайте выгрузки и контролируйте происхождение информации."}
              </p>
            </div>
            {page !== "calculator" && page !== "data" && (
              <button
                className={ui("button")}
                onClick={() =>
                  saveFile(
                    `export/${page === "projects" ? "projects" : "companies"}?${qs(filters)}`,
                    `${page === "projects" ? "projects" : "companies"}.csv`,
                  )
                }
              >
                <ArrowDownToLine size={16} /> Экспорт CSV
              </button>
            )}
          </div>
          {error && (
            <div className={ui("error error-row")} role="alert">
              {error}
              <button
                className={ui("text-button")}
                onClick={() => setRevision((r) => r + 1)}
              >
                Повторить
              </button>
            </div>
          )}
          {page !== "calculator" && page !== "data" && (
            <>
              <div className={ui("demo-banner")}>
                <span className={ui("demo-dot")} />
                <p>
                  <b>
                    {filters.demo === "false"
                      ? "Реальные исходные данные."
                      : filters.demo === "true"
                        ? "Демонстрационный набор."
                        : "Смешанная выборка."}
                  </b>{" "}
                  Неизвестные выручка, статус деятельности и координаты требуют
                  дополнительных источников.
                </p>
                <button onClick={() => navigate("data")}>
                  Загрузить реальные данные <ArrowRight size={14} />
                </button>
              </div>
              {insights &&
                insights.companies > 0 &&
                !insights.demoCount &&
                !insights.registryCoverage && (
                  <div className={ui("info-note geo-coverage")}>
                    Загружена клиентская база, но региональная выгрузка ФНС ещё
                    не подключена. Доля клиентов в этой выборке не отражает
                    присутствие на всём рынке.
                  </div>
                )}
              <div className={ui("global-filters")}>
                <Field label="Регион">
                  <Select
                    value={filters.region}
                    onChange={(v) => filter("region", v)}
                    options={catalog.regions}
                    all="Все регионы"
                  />
                </Field>
                <Field label="Отрасль">
                  <Select
                    value={filters.industry}
                    onChange={(v) => filter("industry", v)}
                    options={catalog.industries}
                    all="Все отрасли"
                  />
                </Field>
                <Field label="Набор данных">
                  <Select
                    value={filters.demo}
                    onChange={(v) => filter("demo", v)}
                    options={[]}
                    all="Все записи"
                  />
                  <select
                    className={ui("dataset-select")}
                    aria-label="Набор данных"
                    value={filters.demo}
                    onChange={(e) => filter("demo", e.target.value)}
                  >
                    <option value="">Все записи</option>
                    <option value="false">Только реальные</option>
                    <option value="true">Только демо</option>
                  </select>
                </Field>
                <button
                  className={ui("reset-button")}
                  onClick={() => {
                    setFilters({ ...initialFilters, region: "" });
                    setSelected(undefined);
                  }}
                >
                  <RefreshCw size={15} /> Сбросить
                </button>
                {loading && <LoaderCircle size={18} className={ui("spin")} />}
              </div>
            </>
          )}
          {page === "overview" && (
            <>
              <Metrics insights={insights} projectCount={projects.length} />
              <div className={ui("overview-grid")}>
                <section className={ui("panel")}>
                  <div className={ui("panel-head")}>
                    <div>
                      <h2>География возможностей</h2>
                      <p>Плотность бизнеса и присутствие Ростелекома</p>
                    </div>
                    <button
                      className={ui("text-button")}
                      onClick={() => navigate("radar")}
                    >
                      Открыть радар <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <MapView
                    points={companies}
                    heat
                    onSelect={(id) => {
                      setSelected(id);
                      setPage("radar");
                      location.hash = "radar";
                    }}
                  />
                  <MapLegend />
                </section>
                <section className={ui("panel opportunities")}>
                  <div className={ui("panel-head")}>
                    <div>
                      <h2>Где есть потенциал</h2>
                      <p>Ниши с низким проникновением</p>
                    </div>
                    <TrendingUp size={20} />
                  </div>
                  {insights?.gaps.length ? (
                    insights.gaps.slice(0, 4).map((g, i) => (
                      <button
                        className={ui("opportunity")}
                        key={g.region + g.industry}
                        onClick={() => {
                          setFilters((f) => ({
                            ...f,
                            region: g.region,
                            industry: g.industry,
                          }));
                          navigate("radar");
                        }}
                      >
                        <span className={ui("rank")}>0{i + 1}</span>
                        <div>
                          <b>{g.industry}</b>
                          <small>{g.region}</small>
                          <span>
                            {g.potentialClients} вне загруженной клиентской базы{" "}
                            <span className={ui("green")}>
                              {g.growth == null
                                ? "Нет данных о росте"
                                : `+${Math.max(0, g.growth)}%`}
                            </span>
                          </span>
                        </div>
                        <ChevronRight size={17} />
                      </button>
                    ))
                  ) : (
                    <Empty />
                  )}
                  <div className={ui("panel-foot")}>
                    При наличии финансовых данных — оценка по росту и выручке.
                    Без них — только число компаний вне загруженной клиентской
                    базы; это не оценка объёма рынка.
                  </div>
                </section>
              </div>
              <section className={ui("panel")}>
                <div className={ui("panel-head")}>
                  <div>
                    <h2>Ближайшие инвестиционные события</h2>
                    <p>Потребности, на которые стоит обратить внимание</p>
                  </div>
                  <button
                    className={ui("text-button")}
                    onClick={() => navigate("projects")}
                  >
                    Все проекты <ArrowRight size={16} />
                  </button>
                </div>
                <ProjectTable
                  projects={projects.slice(0, 4)}
                  onSelect={(p) => {
                    setSelected(p.id);
                    setPage("projects");
                    location.hash = "projects";
                  }}
                />
              </section>
            </>
          )}
          {page === "radar" && (
            <>
              <RegistryFilters filters={filters} update={filter} />
              <div className={ui("info-note geo-coverage")}>
                На карте только объекты с известными координатами:{" "}
                {insights?.locatedCompanies ?? 0} из {insights?.companies ?? 0}.
                Приблизительные точки обозначают населённый пункт или район.
                Фактический офис требует подтверждения. В таблице показано до
                1000 компаний; экспорт включает всю выборку.
              </div>
              <Metrics insights={insights} />
              <div className={ui("toolbar")}>
                <div className={ui("search-box")}>
                  <Search size={17} />
                  <input
                    aria-label="Поиск компании"
                    placeholder="Компания, ИНН или адрес"
                    value={filters.q}
                    onChange={(e) => filter("q", e.target.value)}
                  />
                </div>
                <Field label="Статус">
                  <Select
                    value={filters.client}
                    onChange={(v) => filter("client", v)}
                    options={[]}
                    all="Все компании"
                  />
                  <select
                    className={ui("dataset-select")}
                    value={filters.client}
                    aria-label="Статус компании"
                    onChange={(e) => filter("client", e.target.value)}
                  >
                    <option value="">Все компании</option>
                    <option value="true">Действующие клиенты</option>
                    <option value="false">Потенциальные клиенты</option>
                  </select>
                </Field>
                <Field label="Выручка от, млн ₽">
                  <input
                    type="number"
                    min="0"
                    value={filters.minRevenue}
                    onChange={(e) => filter("minRevenue", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Рост от, %">
                  <input
                    type="number"
                    min="-100"
                    value={filters.minGrowth}
                    onChange={(e) => filter("minGrowth", e.target.value)}
                    placeholder="−100"
                  />
                </Field>
              </div>
              <div
                className={ui(
                  `radar-layout ${activeCompany ? "with-detail" : ""}`,
                )}
              >
                <section className={ui("panel")}>
                  <div className={ui("panel-head")}>
                    <h2>
                      Карта присутствия{" "}
                      <span className={ui("count")}>{companies.length}</span>
                    </h2>
                    <Badge>Тепловой слой</Badge>
                  </div>
                  <MapView
                    points={companies}
                    heat
                    selected={selected}
                    onSelect={setSelected}
                    bounds={filters.bounds}
                    onZone={(v) => filter("bounds", v)}
                  />
                  <MapLegend />
                </section>
                {activeCompany && (
                  <CompanyDetail
                    company={activeCompany}
                    onClose={() => setSelected(undefined)}
                    onEstimate={() => {
                      setEstimateInput({
                        ...defaultEstimate,
                        region: activeCompany.region,
                        customer: activeCompany.name,
                      });
                      navigate("calculator");
                    }}
                  />
                )}
              </div>
              <section className={ui("panel")}>
                <div className={ui("panel-head")}>
                  <h2>Компании региона</h2>
                  <button
                    className={ui("text-button")}
                    onClick={() =>
                      saveFile(
                        "export/companies?crm=true&" + qs(filters),
                        "companies-crm.csv",
                      )
                    }
                  >
                    <ArrowDownToLine size={16} /> Выгрузить для CRM
                  </button>
                </div>
                {companies.length ? (
                  <div className={ui("table-scroll")}>
                    <table>
                      <thead>
                        <tr>
                          <th>Компания / ИНН</th>
                          <th>Отрасль</th>
                          <th>Выручка, млн ₽</th>
                          <th>Динамика</th>
                          <th>Статус</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((c) => (
                          <tr
                            key={c.id}
                            className={ui(
                              selected === c.id ? "selected-row" : "",
                            )}
                          >
                            <td>
                              <button
                                className={ui("table-link")}
                                onClick={() => setSelected(c.id)}
                              >
                                {c.name}
                              </button>
                              <small>
                                {c.inn} · {c.demo ? "Демо" : "Реальные данные"}
                              </small>
                            </td>
                            <td>{c.industry}</td>
                            <td>{money(c.revenue)}</td>
                            <td
                              className={ui(
                                c.growth == null
                                  ? "muted"
                                  : c.growth >= 0
                                    ? "green"
                                    : "orange",
                              )}
                            >
                              {c.growth != null && c.growth > 0 ? "+" : ""}
                              {c.growth == null ? "—" : `${c.growth}%`}
                            </td>
                            <td>
                              <Badge tone={c.client ? "purple" : "neutral"}>
                                {c.client === true
                                  ? "Клиент"
                                  : c.client === false
                                    ? "Не найден в базе клиентов"
                                    : "Не проверено"}
                              </Badge>
                            </td>
                            <td>
                              <IconButton
                                label={`Открыть ${c.name}`}
                                onClick={() => setSelected(c.id)}
                              >
                                <ArrowUpRight size={17} />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty />
                )}
              </section>
            </>
          )}
          {page === "projects" && (
            <>
              <div className={ui("toolbar")}>
                <div className={ui("search-box")}>
                  <Search size={17} />
                  <input
                    aria-label="Поиск проекта"
                    placeholder="Проект или инициатор"
                    value={filters.q}
                    onChange={(e) => filter("q", e.target.value)}
                  />
                </div>
                <Field label="Стадия">
                  <Select
                    value={filters.stage}
                    onChange={(v) => filter("stage", v)}
                    options={catalog.stages}
                    all="Все стадии"
                  />
                </Field>
                <Field label="Потребность">
                  <Select
                    value={filters.need}
                    onChange={(v) => filter("need", v)}
                    options={catalog.needs}
                    all="Все потребности"
                  />
                </Field>
                <button
                  className={ui("button primary")}
                  onClick={() => setSubscriptionOpen(true)}
                >
                  <Bell size={16} /> Подписаться
                </button>
              </div>
              <div className={ui("projects-summary")}>
                <span>
                  <b>{projects.length}</b> проектов найдено
                </span>
                <span>
                  Объём инвестиций{" "}
                  <b>
                    {compact(
                      projects.reduce((n, p) => n + (p.investment ?? 0), 0) *
                        1e6,
                    )}{" "}
                    ₽
                  </b>
                </span>
                <span>Связь событий с объектами на карте</span>
              </div>
              <div className={ui("projects-layout")}>
                <section className={ui("panel timeline-panel")}>
                  <div className={ui("panel-head")}>
                    <h2>Лента инвестиционных событий</h2>
                    <Compass size={19} />
                  </div>
                  {projects.length ? (
                    projects.map((p) => (
                      <article
                        key={p.id}
                        className={ui(
                          `timeline-item ${selected === p.id ? "selected" : ""}`,
                        )}
                      >
                        <div className={ui("timeline-date")}>
                          <span>
                            {p.datePrecision === "year"
                              ? p.date
                              : !p.date
                                ? "—"
                                : new Date(p.date + "T12:00").getDate()}
                          </span>
                          {p.datePrecision === "year"
                            ? "план"
                            : !p.date
                              ? "нет даты"
                              : new Date(p.date + "T12:00").toLocaleDateString(
                                  "ru-RU",
                                  { month: "short" },
                                )}
                        </div>
                        <div className={ui("timeline-body")}>
                          <div className={ui("flex-between")}>
                            <Badge
                              tone={p.stage === "Запуск" ? "green" : "purple"}
                            >
                              {p.stage}
                            </Badge>
                            <small>{p.demo ? "ДЕМО" : "ИСТОЧНИК"}</small>
                          </div>
                          <button
                            className={ui("project-name")}
                            onClick={() => setSelected(p.id)}
                          >
                            {p.name}
                          </button>
                          <p>{p.initiator}</p>
                          <div className={ui("project-meta")}>
                            <span>
                              <MapPin size={13} />
                              {p.region}
                            </span>
                            <span>{p.industry}</span>
                          </div>
                          <div className={ui("flex-between project-bottom")}>
                            <b>{money(p.investment)} млн ₽</b>
                            <span className={ui("need-label")}>
                              {p.needStatus === "suggested"
                                ? "Предположение: "
                                : ""}
                              {p.need}
                            </span>
                          </div>
                          <Source record={p} />
                          <div className={ui("project-actions")}>
                            <button
                              className={ui("text-button")}
                              onClick={() => setSelected(p.id)}
                            >
                              На карте <ArrowUpRight size={14} />
                            </button>
                            <button
                              className={ui("text-button")}
                              onClick={() => toCalculator(p)}
                            >
                              Оценить сделку <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty />
                  )}
                </section>
                <section className={ui("panel project-map-panel")}>
                  <div className={ui("panel-head")}>
                    <h2>Карта проектов</h2>
                    <span className={ui("muted")}>
                      {projects.length} объектов
                    </span>
                  </div>
                  <MapView
                    points={activeProject ? [activeProject] : projects}
                    selected={selected}
                    onSelect={setSelected}
                  />
                  {activeProject ? (
                    <div className={ui("project-map-detail")}>
                      <div className={ui("flex-between")}>
                        <Badge>
                          {activeProject.needStatus === "suggested"
                            ? "Предположение: "
                            : ""}
                          {activeProject.need}
                        </Badge>
                        <IconButton
                          label="Показать все проекты"
                          onClick={() => setSelected(undefined)}
                        >
                          <X size={16} />
                        </IconButton>
                      </div>
                      <h3>{activeProject.name}</h3>
                      <p>{activeProject.initiator}</p>
                      <div className={ui("detail-row")}>
                        <span>Событие</span>
                        <b>{date(activeProject.date)}</b>
                      </div>
                      <div className={ui("detail-row")}>
                        <span>Инвестиции</span>
                        <b>{money(activeProject.investment)} млн ₽</b>
                      </div>
                      <button
                        className={ui("button primary wide")}
                        onClick={() => toCalculator(activeProject)}
                      >
                        Рассчитать предложение <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className={ui("panel-foot")}>
                      Выберите событие в ленте или объект на карте, чтобы
                      увидеть детали.
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {page === "calculator" && (
            <CalculatorPage
              catalog={catalog}
              input={estimateInput}
              setInput={setEstimateInput}
              saveFile={saveFile}
            />
          )}
          {page === "data" && (
            <DataPage
              notify={notify}
              onImported={() => setRevision((r) => r + 1)}
              saveFile={saveFile}
            />
          )}
          <footer className={ui("footer")}>
            <span>© Ростелеком · Коммерческая экосистема</span>
            <span>Прототип · Хакатон 2026</span>
          </footer>
        </main>
      </div>
      {authenticatorOpen && <AuthenticatorSettings close={() => setAuthenticatorOpen(false)} />}
      {subscriptionOpen && (
        <Subscriptions
          filters={filters}
          catalog={catalog}
          notifications={notifications}
          close={() => setSubscriptionOpen(false)}
          notify={notify}
          refresh={() => setRevision((r) => r + 1)}
          onProject={(p) => {
            setFilters({ ...initialFilters, region: p.region });
            setSelected(p.id);
            setSubscriptionOpen(false);
            navigate("projects");
            setSelected(p.id);
          }}
        />
      )}
      {toast && (
        <div className={ui("toast")} role="status">
          <Check size={18} />
          {toast}
          <IconButton label="Закрыть сообщение" onClick={() => setToast("")}>
            <X size={15} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
function Metrics({ insights: i, projectCount }) {
  const count = i?.companies ?? 0,
    clients = i?.clients ?? 0;
  return (
    <div className={ui("metrics")}>
      <div className={ui("metric")}>
        <div>
          <span>Компаний в выборке</span>
          <Building2 size={18} />
        </div>
        <b>{money(count)}</b>
        <small>
          {count - clients - (i?.unknownClients ?? 0)} вне клиентской базы;{" "}
          {i?.unknownClients ?? 0} не проверено
        </small>
      </div>
      <div className={ui("metric")}>
        <div>
          <span>Доля клиентов в выборке</span>
          <Radar size={18} />
        </div>
        <b>
          {count ? Math.round((clients / count) * 100) : 0}
          <em>%</em>
        </b>
        <small>{clients} компаний в клиентской базе</small>
      </div>
      <div className={ui("metric")}>
        <div>
          <span>Совокупная выручка</span>
          <TrendingUp size={18} />
        </div>
        <b>
          {i?.revenue == null ? "—" : compact(i.revenue * 1e6)}
          <em> ₽</em>
        </b>
        <small>
          Выручка известна для {i?.revenueCoverage ?? 0} из {count} компаний
        </small>
      </div>
      <div className={ui("metric")}>
        <div>
          <span>
            {projectCount !== undefined
              ? "Инвестиционных проектов"
              : "Средняя динамика выручки"}
          </span>
          <Compass size={18} />
        </div>
        <b>
          {projectCount !== undefined
            ? projectCount
            : i?.growth == null
              ? "—"
              : `${i.growth > 0 ? "+" : ""}${i.growth}%`}
        </b>
        <small>
          {projectCount !== undefined
            ? "События в выбранном регионе"
            : "По компаниям в текущей выборке"}
        </small>
      </div>
    </div>
  );
}
function MapLegend() {
  return (
    <div className={ui("map-legend")}>
      <span>
        <i className={ui("purple-dot")} />
        Действующие клиенты
      </span>
      <span>
        <i className={ui("orange-dot")} />
        Потенциальные клиенты
      </span>
      <small>Размер точки — выручка</small>
    </div>
  );
}
function CompanyDetail({ company: c, onClose, onEstimate }) {
  return (
    <aside className={ui("panel company-detail")}>
      <div className={ui("flex-between")}>
        <span className={ui("detail-icon")}>
          <Building2 size={24} />
        </span>
        <IconButton label="Закрыть карточку компании" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <Badge tone={c.client ? "purple" : "neutral"}>
        {c.client === true
          ? "Действующий клиент"
          : c.client === false
            ? "Не найден в базе клиентов"
            : "Клиентский статус не проверен"}
      </Badge>
      <h2>{c.name}</h2>
      <p className={ui("muted")}>ИНН {c.inn}</p>
      <div className={ui("detail-row")}>
        <span>Отрасль</span>
        <b>{c.industry}</b>
      </div>
      <div className={ui("detail-row")}>
        <span>Выручка</span>
        <b>{money(c.revenue)} млн ₽</b>
      </div>
      <div className={ui("detail-row")}>
        <span>Динамика</span>
        <b className={ui("green")}>
          {c.growth != null && c.growth > 0 ? "+" : ""}
          {c.growth == null ? "—" : `${c.growth}%`}
        </b>
      </div>
      <div className={ui("detail-row")}>
        <span>Сотрудников</span>
        <b>{c.employees ?? "—"}</b>
      </div>
      <p className={ui("address")}>
        <MapPin size={16} />
        {c.address}
      </p>
      <CompanyRegistry company={c} />
      <Source record={c} />
      <small className={ui("muted")}>Обновлено {date(c.updatedAt)}</small>
      <button className={ui("button primary wide")} onClick={onEstimate}>
        Оценить предложение <ArrowRight size={15} />
      </button>
    </aside>
  );
}
function ProjectTable({ projects, onSelect }) {
  return projects.length ? (
    <div className={ui("table-scroll")}>
      <table>
        <thead>
          <tr>
            <th>Проект</th>
            <th>Стадия</th>
            <th>Потребность</th>
            <th>Инвестиции</th>
            <th>Событие</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>
                <button
                  className={ui("table-link")}
                  onClick={() => onSelect(p)}
                >
                  {p.name}
                </button>
                <small>{p.initiator}</small>
              </td>
              <td>
                <Badge>{p.stage}</Badge>
              </td>
              <td>
                {p.needStatus === "suggested" ? "Предположение: " : ""}
                {p.need}
              </td>
              <td>{money(p.investment)} млн ₽</td>
              <td>{date(p.date)}</td>
              <td>
                <IconButton
                  label="Подробнее о проекте"
                  onClick={() => onSelect(p)}
                >
                  <ArrowUpRight size={17} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty />
  );
}
function CalculatorPage({ catalog, input, setInput, saveFile }) {
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stale =
    !!result && JSON.stringify(result.input) !== JSON.stringify(input);
  const update = (key, value) => setInput({ ...input, [key]: value });
  async function calculate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await api("estimate", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={ui("calculator-layout")}>
      <form onSubmit={calculate} className={ui("panel calculator-form")}>
        <div className={ui("panel-head")}>
          <h2>Параметры проекта</h2>
          <SlidersHorizontal size={19} />
        </div>
        <div className={ui("form-body")}>
          <Field label="Заказчик">
            <input
              value={input.customer}
              onChange={(e) => update("customer", e.target.value)}
              placeholder="Название компании"
              maxLength={200}
            />
          </Field>
          <Field label="Тип проекта">
            <Select
              value={input.type}
              onChange={(v) => update("type", v)}
              options={catalog.needs}
            />
          </Field>
          <Field label="Регион реализации">
            <Select
              value={input.region}
              onChange={(v) => update("region", v)}
              options={catalog.regions}
            />
          </Field>
          <div className={ui("form-two")}>
            <Field label="Масштаб, единиц">
              <input
                type="number"
                required
                min="1"
                max="100000"
                value={input.units}
                onChange={(e) => update("units", Number(e.target.value))}
              />
            </Field>
            <Field label="Срок, месяцев">
              <input
                type="number"
                required
                min="1"
                max="120"
                value={input.months}
                onChange={(e) => update("months", Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Схема финансирования">
            <Select
              value={input.financing}
              onChange={(v) => update("financing", v)}
              options={["Единовременно", "Рассрочка", "Лизинг"]}
            />
          </Field>
          <PricingPicker input={input} setInput={setInput} />
          <h3 className={ui("form-section-title")}>Себестоимость, ₽ без НДС</h3>
          {[
            ["equipment", "Оборудование"],
            ["software", "Программное обеспечение"],
            ["labor", "Работы и внедрение"],
          ].map(([k, label]) => (
            <Field key={k} label={label}>
              <input
                type="number"
                required
                min="0"
                max="1000000000000"
                step="100"
                value={input[k]}
                onChange={(e) => update(k, Number(e.target.value))}
              />
            </Field>
          ))}
          <label className={ui("checkbox")}>
            <input
              type="checkbox"
              checked={input.urgent}
              onChange={(e) => update("urgent", e.target.checked)}
            />
            <span>Срочное выполнение</span>
            <small>× 1,15</small>
          </label>
          <label className={ui("checkbox")}>
            <input
              type="checkbox"
              checked={input.unique}
              onChange={(e) => update("unique", e.target.checked)}
            />
            <span>Уникальное решение / нестандартное ПО</span>
            <small>× 1,20</small>
          </label>
          {error && (
            <div className={ui("error")} role="alert">
              {error}
            </div>
          )}
          <button className={ui("button primary wide")} disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className={ui("spin")} />
            ) : (
              <Calculator size={17} />
            )}
            Рассчитать стоимость
          </button>
        </div>
      </form>
      <div className={ui("calculation-results")}>
        {result ? (
          <>
            <section className={ui("panel price-panel")}>
              <div className={ui("panel-head")}>
                <div>
                  <h2>Рекомендуемый диапазон</h2>
                  <p>Оценка без НДС · {result.input.type}</p>
                </div>
                <Badge tone={result.demo ? "orange" : "green"}>
                  {result.demo ? "Демо-расчёт" : "По истории сделок"}
                </Badge>
              </div>
              {stale && (
                <div className={ui("stale-banner")}>
                  Параметры изменены. Пересчитайте стоимость перед экспортом.
                </div>
              )}
              <div className={ui("price-range")}>
                <div>
                  <span>Минимум</span>
                  <b>{money(result.minimum)} ₽</b>
                  <small>Нижняя граница</small>
                </div>
                <div className={ui("optimum")}>
                  <span>Оптимальная цена</span>
                  <b>{money(result.optimum)} ₽</b>
                  <small>Маржинальность {result.margin}%</small>
                </div>
                <div>
                  <span>Верхняя граница</span>
                  <b>{money(result.maximum)} ₽</b>
                  <small>Резерв для переговоров</small>
                </div>
              </div>
              <div className={ui("range-bar")}>
                <i />
                <i />
                <i />
              </div>
              <div className={ui("calculation-note")}>
                {result.demo
                  ? "Расчёт основан на синтетических сделках. Для обоснования рыночной цены загрузите реальную историю."
                  : "Оценка по импортированной истории сделок. Финальная стоимость уточняется после обследования."}
              </div>
              <div className={ui("export-actions")}>
                <button
                  className={ui("button primary")}
                  disabled={stale}
                  onClick={() =>
                    saveFile(
                      "estimate/export/docx",
                      "commercial-proposal.docx",
                      result.input,
                    )
                  }
                >
                  <FileText size={16} /> Предложение DOCX
                </button>
                <button
                  className={ui("button")}
                  disabled={stale}
                  onClick={() =>
                    saveFile(
                      "estimate/export/doc",
                      "commercial-proposal.doc",
                      result.input,
                    )
                  }
                >
                  DOC
                </button>
                <button
                  className={ui("button")}
                  disabled={stale}
                  onClick={() =>
                    saveFile(
                      "estimate/export/csv",
                      "estimate.csv",
                      result.input,
                    )
                  }
                >
                  <ArrowDownToLine size={16} /> CSV / CRM
                </button>
              </div>
            </section>
            <section className={ui("panel")}>
              <div className={ui("panel-head")}>
                <h2>Маржинальность и структура цены</h2>
                <Badge tone="neutral">
                  Точность: {result.confidence.toLowerCase()}
                </Badge>
              </div>
              <MarginChart result={result} />
              <div className={ui("coefficient-grid")}>
                {[
                  ["Регион", result.regional],
                  ["Срочность", result.urgency],
                  ["Уникальность", result.unique],
                  ["Финансирование", result.financing],
                ].map(([label, v]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>× {v}</b>
                  </div>
                ))}
              </div>
              <p className={ui("method-note")}>{result.method}</p>
            </section>
            <section className={ui("panel")}>
              <div className={ui("panel-head")}>
                <div>
                  <h2>Сопоставимые проекты</h2>
                  <p>
                    {result.analogs.length} ближайших аналогов по типу,
                    масштабу, сроку и региону
                  </p>
                </div>
              </div>
              <div className={ui("table-scroll")}>
                <table>
                  <thead>
                    <tr>
                      <th>Проект</th>
                      <th>Объём</th>
                      <th>Цена</th>
                      <th>Цена за единицу</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.analogs.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <b>{a.name}</b>
                          <small>
                            {a.region} · {a.demo ? "Демо" : "Импорт"}
                          </small>
                        </td>
                        <td>{a.units} ед.</td>
                        <td>{money(a.price)} ₽</td>
                        <td>{money(a.price / a.units)} ₽</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className={ui("panel calculator-placeholder")}>
            <div className={ui("placeholder-symbol")}>
              <Calculator size={38} />
            </div>
            <h2>От параметров — к предложению</h2>
            <p>
              Задайте объём, сроки и себестоимость.
              <br />
              Система подберёт аналогичные сделки
              <br />и рассчитает диапазон цены.
            </p>
            <div className={ui("calculation-steps")}>
              <span>
                <b>01</b> Параметры проекта
              </span>
              <ChevronRight size={17} />
              <span>
                <b>02</b> Сравнение с аналогами
              </span>
              <ChevronRight size={17} />
              <span>
                <b>03</b> Коммерческое предложение
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
function MarginChart({ result: r }) {
  const prices = [r.minimum, r.optimum, r.maximum];
  return (
    <div className={ui("margin-chart")}>
      <div className={ui("chart-axis")}>
        <span>Цена и себестоимость, ₽</span>
        <span>Маржа</span>
      </div>
      {prices.map((price, i) => (
        <div className={ui("chart-row")} key={i}>
          <span>{["Минимум", "Оптимум", "Максимум"][i]}</span>
          <div
            className={ui("chart-track")}
            aria-label={`Цена ${money(price)}; себестоимость ${money(r.cost)}`}
          >
            <svg className="h-full w-full overflow-visible" aria-hidden="true">
              <rect
                width={`${(price / r.maximum) * 100}%`}
                height="100%"
                rx="4"
                className="fill-brand"
              />
              <rect
                width={`${(r.cost / r.maximum) * 100}%`}
                height="100%"
                rx="4"
                className="fill-[#e2d7f2]"
              />
            </svg>
          </div>
          <b>{Math.round(((price - r.cost) / price) * 100)}%</b>
        </div>
      ))}
      <div className={ui("chart-legend")}>
        <span>
          <i className={ui("cost-dot")} />
          Себестоимость {money(r.cost)} ₽
        </span>
        <span>
          <i className={ui("purple-dot")} />
          Валовая прибыль
        </span>
      </div>
    </div>
  );
}
function DataPage({ notify, onImported, saveFile }) {
  const [status, setStatus] = useState([]),
    [kind, setKind] = useState("companies"),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [lastImport, setLastImport] = useState("");
  useEffect(() => {
    let current = true;
    api("data-status")
      .then((s) => {
        if (current) setStatus(s);
      })
      .catch((e) => setError(e.message));
    return () => {
      current = false;
    };
  }, [revision]);
  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setLastImport("");
    try {
      if (file.size > 5000000)
        throw new Error("Максимальный размер файла — 5 МБ");
      const r = await api("import/" + kind + "?filename=" + encodeURIComponent(file.name), {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      setLastImport(`Импортировано ${r.imported} записей. ${r.message}`);
      notify("Импорт завершён");
      setRevision((r) => r + 1);
      onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <RegistryImport
        notify={notify}
        onImported={() => {
          setRevision((r) => r + 1);
          onImported();
        }}
      />
      <div className={ui("data-status-grid")}>
        {status.map((s) => (
          <section className={ui("panel data-status")} key={s.kind}>
            <span className={ui("detail-icon")}>
              <Database size={20} />
            </span>
            <h2>
              {
                {
                  companies: "Компании",
                  projects: "Инвестиционные проекты",
                  deals: "История сделок",
                  clients: "Клиентские ИНН",
                  sites: "Площадки деятельности",
                }[s.kind]
              }
            </h2>
            <b className={ui("data-count")}>{s.count}</b>
            <div className={ui("data-counts")}>
              <span>{s.count - s.demo} реальных</span>
              <span>{s.demo} демонстрационных</span>
            </div>
            <p>{s.sources.join(" · ")}</p>
          </section>
        ))}
      </div>
      <div className={ui("data-layout")}>
        <form className={ui("panel")} onSubmit={upload}>
          <div className={ui("panel-head")}>
            <h2>Импорт CSV, DOC и DOCX</h2>
            <Upload size={19} />
          </div>
          <div className={ui("form-body")}>
            <p className={ui("muted")}>
              Загрузите CSV или таблицы из Word с компаниями, проектами или
              сделками. Первая строка таблицы — названия полей из шаблона.
              Все таблицы документа должны относиться к выбранному типу данных.
            </p>
            <Field label="Тип данных">
              <Select
                value={kind}
                onChange={(v) => {
                  setKind(v);
                  setFile(null);
                  setError("");
                }}
                options={[]}
              />
              <select
                className={ui("dataset-select")}
                aria-label="Тип импортируемых данных"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setFile(null);
                  setError("");
                }}
              >
                <option value="companies">Компании</option>
                <option value="projects">Инвестиционные проекты</option>
                <option value="deals">История сделок</option>
              </select>
            </Field>
            <button
              type="button"
              className={ui("text-button")}
              onClick={() =>
                saveFile("template/" + kind, `${kind}-template.csv`)
              }
            >
              <ArrowDownToLine size={16} /> Скачать шаблон CSV
            </button>
            <button
              type="button"
              className={ui("text-button")}
              onClick={() =>
                saveFile("template/" + kind + "?format=docx", `${kind}-template.docx`)
              }
            >
              <ArrowDownToLine size={16} /> Скачать шаблон Word
            </button>
            <label className={ui("upload-box")}>
              <Upload size={28} />
              <b>{file ? file.name : "Выберите CSV, DOC или DOCX"}</b>
              <span>До 5 МБ и 10 000 записей · Word: таблицы без объединённых ячеек</span>
              <input
                key={kind}
                type="file"
                accept=".csv,.doc,.docx,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setLastImport("");
                }}
                required
              />
            </label>
            {error && (
              <div className={ui("error")} role="alert">
                {error}
              </div>
            )}
            {lastImport && (
              <div className={ui("success")} role="status">
                {lastImport}
              </div>
            )}
            <button className={ui("button primary")} disabled={busy || !file}>
              {busy ? (
                <LoaderCircle className={ui("spin")} size={16} />
              ) : (
                <Upload size={16} />
              )}
              Проверить и импортировать
            </button>
          </div>
        </form>
        <section className={ui("panel source-guide")}>
          <div className={ui("panel-head")}>
            <h2>Как работают данные</h2>
            <ShieldCheck size={19} />
          </div>
          <div className={ui("form-body")}>
            <h3>Прозрачное происхождение</h3>
            <p>
              Для каждой записи сохраняются название источника, ссылка и дата
              обновления. Импортированные записи отделены от демо-набора.
            </p>
            <h3>Проверка перед сохранением</h3>
            <p>
              Обязательные поля, формат ИНН, координаты, даты и числовые
              диапазоны проверяются до записи. Ошибка в одной строке отменяет
              весь импорт.
            </p>
            <h3>Обновление без дубликатов</h3>
            <p>
              Компании сопоставляются по ИНН, проекты — по названию, региону и
              инициатору, сделки — по названию, региону и дате.
            </p>
            <h3>Расчёт по вашей истории</h3>
            <p>
              Если для выбранного типа проекта есть реальные сделки, калькулятор
              использует только их. Иначе результат обозначается как
              демонстрационный.
            </p>
            <h3>Новые инвестиционные события</h3>
            <p>
              Подписки отслеживают новые записи после импорта. Уведомления
              появляются в приложении, проверка — каждую минуту.
            </p>
            <div className={ui("info-note")}>
              Прямые подключения к ФНС и ЕИС не настроены. Источники
              подключаются через подготовленные CSV-выгрузки.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
function Subscriptions({
  filters,
  catalog,
  notifications,
  close,
  notify,
  refresh,
  onProject,
}) {
  const [items, setItems] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [f, setF] = useState({
      region: filters.region,
      industry: filters.industry,
      need: filters.need,
      stage: filters.stage,
    });
  const dialogRef = useRef(null),
    previousFocus = useRef(document.activeElement);
  useEffect(() => {
    api("subscriptions")
      .then(setItems)
      .catch((e) => setError(e.message));
    dialogRef.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll(
          "button:not([disabled]),select,input,a[href]",
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const alreadyLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", handler);
      if (!alreadyLocked) document.body.classList.remove("overflow-hidden");
      previousFocus.current?.focus();
    };
  }, []);
  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await api("subscriptions", {
        method: "POST",
        body: JSON.stringify(f),
      });
      setItems([...items, s]);
      notify("Подписка создана. Новые проекты появятся в уведомлениях.");
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={ui("modal-backdrop")} onClick={close}>
      <div
        className={ui("drawer")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscriptions-title"
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={ui("panel-head")}>
          <h2 id="subscriptions-title">Подписки и уведомления</h2>
          <IconButton label="Закрыть подписки" onClick={close}>
            <X size={21} />
          </IconButton>
        </div>
        <div className={ui("drawer-body")}>
          <h3>
            Новые события{" "}
            <span className={ui("count")}>{notifications.length}</span>
          </h3>
          {notifications.length ? (
            <>
              <div className={ui("notifications")}>
                {notifications.map((p) => (
                  <button key={p.id} onClick={() => onProject(p)}>
                    <Badge>{p.need}</Badge>
                    <b>{p.name}</b>
                    <small>{p.region}</small>
                  </button>
                ))}
              </div>
              <button
                className={ui("text-button")}
                onClick={async () => {
                  try {
                    await api("notifications/read", { method: "POST" });
                    refresh();
                    notify("Уведомления прочитаны");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Отметить всё прочитанным
              </button>
            </>
          ) : (
            <p className={ui("muted")}>
              Новых проектов по подпискам пока нет. После импорта подходящие
              события появятся здесь.
            </p>
          )}
          <form onSubmit={add} className={ui("subscription-form")}>
            <h3>Создать подписку</h3>
            <Field label="Регион">
              <Select
                value={f.region}
                options={catalog.regions}
                all="Все регионы"
                onChange={(v) => setF({ ...f, region: v })}
              />
            </Field>
            <Field label="Отрасль">
              <Select
                value={f.industry}
                options={catalog.industries}
                all="Все отрасли"
                onChange={(v) => setF({ ...f, industry: v })}
              />
            </Field>
            <Field label="Потребность">
              <Select
                value={f.need}
                options={catalog.needs}
                all="Все потребности"
                onChange={(v) => setF({ ...f, need: v })}
              />
            </Field>
            <Field label="Стадия">
              <Select
                value={f.stage}
                options={catalog.stages}
                all="Все стадии"
                onChange={(v) => setF({ ...f, stage: v })}
              />
            </Field>
            {error && (
              <div className={ui("error")} role="alert">
                {error}
              </div>
            )}
            <button className={ui("button primary")} disabled={busy}>
              <Plus size={16} />
              Создать подписку
            </button>
          </form>
          <h3>Активные подписки</h3>
          {items.length ? (
            items.map((s) => (
              <div className={ui("subscription-item")} key={s.id}>
                <div>
                  <b>{s.region || "Все регионы"}</b>
                  <span>
                    {[s.industry, s.need, s.stage]
                      .filter(Boolean)
                      .join(" · ") || "Все отрасли и стадии"}
                  </span>
                </div>
                <IconButton
                  label="Удалить подписку"
                  onClick={async () => {
                    try {
                      await api("subscriptions/" + s.id, { method: "DELETE" });
                      setItems(items.filter((i) => i.id !== s.id));
                      refresh();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  <X size={17} />
                </IconButton>
              </div>
            ))
          ) : (
            <p className={ui("muted")}>Подписок ещё нет.</p>
          )}
        </div>
      </div>
    </div>
  );
}
document.documentElement.className = documentClasses;
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
