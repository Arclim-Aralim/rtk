import { ui } from "./ui";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ExternalLink,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { api, download } from "./api";
export function RegistryFilters({ filters, update }) {
  return (
    <div className={ui("registry-filters")}>
      <label className={ui("field")}>
        <span>Статус реестра и деятельности</span>
        <select
          value={filters.registryStatus}
          onChange={(e) => update("registryStatus", e.target.value)}
        >
          <option value="current">Без исключённых и закрытых</option>
          <option value="all">Все записи, включая архив</option>
          <option value="excluded">Исключены из МСП</option>
          <option value="terminated">Деятельность прекращена</option>
        </select>
      </label>
      <label className={ui("field")}>
        <span>География</span>
        <select
          value={filters.locationMode}
          onChange={(e) => update("locationMode", e.target.value)}
        >
          <option value="registration">По месту регистрации</option>
          <option value="operations">По площадкам деятельности</option>
          <option value="both">Регистрация и площадки</option>
        </select>
      </label>
      <label className={ui("field")}>
        <span>Расхождение адресов</span>
        <select
          value={filters.crossLocation}
          onChange={(e) => update("crossLocation", e.target.value)}
        >
          <option value="">Все компании</option>
          <option value="region">Деятельность в другом регионе</option>
          <option value="locality">
            Деятельность в другом населённом пункте
          </option>
          <option value="candidates">Есть неподтверждённые площадки</option>
        </select>
      </label>
      <label className={ui("field")}>
        <span>Площадки на карте</span>
        <select
          value={filters.siteConfidence}
          onChange={(e) => update("siteConfidence", e.target.value)}
        >
          <option value="confirmed">Только подтверждённые</option>
          <option value="all">Также требующие проверки</option>
        </select>
      </label>
    </div>
  );
}
export function CompanyRegistry({ company: c }) {
  return (
    <div className={ui("company-registry")}>
      <h3>Регистрация и статус</h3>
      <p>
        {c.registrationAddress || c.address || "Адрес регистрации не указан"}
      </p>
      <div className={ui("registry-labels")}>
        <span>
          {c.mspStatus === "excluded"
            ? "Исключён из МСП"
            : c.mspStatus === "present"
              ? "В реестре МСП"
              : "Статус МСП не проверен"}
        </span>
        <span>
          {c.activityStatus === "terminated"
            ? "Деятельность прекращена"
            : c.activityStatus === "active"
              ? "Действует по источнику"
              : "Статус деятельности не проверен"}
        </span>
      </div>
      {c.mspExcludedAt && (
        <p>
          Дата исключения из МСП: {c.mspExcludedAt}. Это не подтверждает
          закрытие бизнеса.
        </p>
      )}
      {(c.geoAccuracy === "locality" || c.geoAccuracy === "district") && (
        <p>
          Координаты приблизительные:{" "}
          {c.geoAccuracy === "locality"
            ? "центр населённого пункта"
            : "точка района"}
          . Фактический офис не установлен.{" "}
          <a href={c.geoSourceUrl} target="_blank" rel="noreferrer">
            GeoNames
          </a>
        </p>
      )}
      <h3>Площадки деятельности</h3>
      {c.operatingSites?.length ? (
        c.operatingSites.map((s) => (
          <div className={ui("site-evidence")} key={s.id}>
            <b>{s.address}</b>
            <span>
              {s.status === "confirmed"
                ? "Подтверждена"
                : s.status === "rejected"
                  ? "Отклонена"
                  : "Требует проверки"}{" "}
              · {s.observedAt}
            </span>
            <a href={s.sourceUrl} target="_blank" rel="noreferrer">
              {s.source} ↗
            </a>
          </div>
        ))
      ) : (
        <p>
          Подтверждённых площадок нет. Адрес регистрации не считается
          фактическим офисом.
        </p>
      )}
      {c.crossRegion && (
        <p className={ui("green")}>
          Подтверждена деятельность в другом регионе.
        </p>
      )}
      {c.crossLocality && !c.crossRegion && (
        <p className={ui("green")}>
          Подтверждена деятельность в другом населённом пункте.
        </p>
      )}
    </div>
  );
}
export function RegistryImport({ notify, onImported }) {
  const [kind, setKind] = useState("fns"),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    [asOf, setAsOf] = useState(() => {
      const d = new Date();
      if (d.getDate() < 10) d.setMonth(d.getMonth() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-10`;
    }),
    [revision, setRevision] = useState(0),
    [status, setStatus] = useState(null);
  useEffect(() => {
    api("registry-status")
      .then(setStatus)
      .catch((e) => setError(e.message));
  }, [revision]);
  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      if (file.size > 25_000_000)
        throw new Error(
          "Файл больше 25 МБ. Разбейте выгрузку на части до 50 000 строк.",
        );
      const r = await api(
        `source-import/${kind}?filename=${encodeURIComponent(file.name)}&asOf=${asOf}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        },
      );
      setResult(`${r.imported} записей. ${r.message}`);
      setRevision((v) => v + 1);
      onImported();
      notify("Исходные данные импортированы");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={ui("panel source-import")}>
      <div className={ui("panel-head")}>
        <div>
          <h2>Клиенты, ФНС и фактические площадки</h2>
          <p>
            Сопоставление по ИНН с сохранением источников и неизвестных значений
          </p>
        </div>
        <a
          className={ui("text-button")}
          href="https://rmsp.nalog.ru/search.html?mode=extended"
          target="_blank"
          rel="noreferrer"
        >
          Реестр МСП <ExternalLink size={14} />
        </a>
      </div>
      <div className={ui("source-import-grid")}>
        <form className={ui("form-body")} onSubmit={submit}>
          <label className={ui("field")}>
            <span>Что загружаем</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setFile(null);
                setError("");
                setResult("");
              }}
            >
              <option value="fns">Выгрузка ФНС — рынок МСП</option>
              <option value="clients">Список действующих клиентов</option>
              <option value="sites">
                Площадки деятельности с подтверждениями
              </option>
              <option value="facts">Фактура хакатона — все листы</option>
            </select>
          </label>
          <>
            {kind === "fns" && (
              <label className={ui("field")}>
                <span>Дата среза ФНС</span>
                <input
                  type="date"
                  required
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </label>
            )}
          </>
          <p className={ui("muted")}>
            {kind === "fns"
              ? "В ФНС выберите Ростовскую область и дату среза, затем экспортируйте Excel. Будут сохранены и даты исключения из МСП. Файл дополняет базу клиентов, сопоставление — по точному ИНН."
              : kind === "clients"
                ? "Все ИНН в этом файле считаются вашими клиентами. Остальные компании реестра помечаются «Не найден в загруженной клиентской базе»."
                : kind === "sites"
                  ? "Один ИНН может иметь несколько площадок. Укажите адрес, источник, ссылку, дату и статус подтверждения. Неподтверждённые адреса не участвуют в основной геоаналитике."
                  : "Загружаются клиентский лист, инвестиционные проекты, базовые цены оборудования и коэффициенты. Год ввода проекта сохраняется как год, без выдуманной точной даты."}
          </p>
          {kind === "sites" && (
            <button
              type="button"
              className={ui("text-button")}
              onClick={() =>
                download("template/sites", "sites-template.csv").catch((e) =>
                  setError(e.message),
                )
              }
            >
              <ArrowDownToLine size={15} />
              Шаблон площадок CSV
            </button>
          )}
          <label className={ui("upload-box")}>
            <Upload size={25} />
            <b>{file?.name || "Выберите XLSX или CSV"}</b>
            <span>
              До 25 МБ и 50 000 строк за импорт · исходные файлы сохраняются у
              вас
            </span>
            <input
              key={kind}
              type="file"
              accept=".xlsx,.csv"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {error && (
            <div className={ui("error")} role="alert">
              {error}
            </div>
          )}
          {result && (
            <div className={ui("success")} role="status">
              {result}
            </div>
          )}
          <button className={ui("button primary")} disabled={!file || busy}>
            {busy ? (
              <LoaderCircle className={ui("spin")} size={16} />
            ) : (
              <Upload size={16} />
            )}
            Импортировать источник
          </button>
        </form>
        <div className={ui("registry-method")}>
          <h3>Состояние сопоставления</h3>
          {status && (
            <dl>
              {[
                ["Компаний из реальных источников", status.companies],
                ["Совпали с клиентской базой", status.matchedClients],
                ["Не найдены в клиентской базе", status.unmatched],
                ["Клиентский статус не проверен", status.unknownClients],
                ["Исключены из реестра МСП", status.excludedMsp],
                ["Подтверждено прекращение деятельности", status.terminated],
                ["Площадок с источниками", status.sites],
              ].map(([label, n]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>
          )}
          <h3>Как решается задача разных адресов</h3>
          <p>
            Сведения о филиалах из ЕГРЮЛ, реквизиты и контакты на сайте
            компании, закупки и карточки организаций могут дать адрес площадки.
            Связь с компанией подтверждается ИНН; совпадение названия само по
            себе недостаточно.
          </p>
          <p>
            Для ИП местом регистрации может быть домашний адрес. Фактический
            офис не выводится из регистрационного адреса и требует отдельного
            свидетельства. Кандидат сохраняется для проверки, а не становится
            подтверждённой площадкой автоматически.
          </p>
          <p>
            Исключение из МСП и прекращение деятельности — разные события.
            Закрытие подтверждается отдельными сведениями ЕГРЮЛ/ЕГРИП. ФНС МСП
            не покрывает весь крупный бизнес.
          </p>
        </div>
      </div>
    </section>
  );
}
