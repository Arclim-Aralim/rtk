import { ui } from "./ui";
import { useEffect, useState } from "react";
import { api, money } from "./api";
export default function PricingPicker({ input, setInput }) {
  const [catalog, setCatalog] = useState(null),
    [quantities, setQuantities] = useState({}),
    [level, setLevel] = useState(1),
    [works, setWorks] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("pricing-catalog")
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  if (!catalog)
    return error ? <div className={ui("error")}>{error}</div> : null;
  const equipment = catalog.items.reduce(
      (s, i) => s + (quantities[i.id] || 0) * i.price,
      0,
    ),
    laborBase = catalog.items.reduce(
      (s, i) => s + (quantities[i.id] || 0) * i.price * i.complexity,
      0,
    ),
    rate = catalog.works
      .filter((w) => works.includes(w.name))
      .reduce((s, w) => s + w.rate, 0),
    labor = Math.round(laborBase * rate * level);
  return (
    <details className={ui("pricing-picker")}>
      <summary>Подобрать оборудование из фактуры</summary>
      <div>
        <p>
          Базовые цены из {catalog.source}. Рыночная актуальность не проверена.
        </p>
        <label className={ui("field")}>
          <span>Уровень проекта</span>
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          >
            {catalog.levels.map((l) => (
              <option key={l.name} value={l.factor}>
                {l.name} × {l.factor}
              </option>
            ))}
          </select>
        </label>
        <div className={ui("pricing-items")}>
          {catalog.items.map((i) => (
            <label key={i.id}>
              <span>
                <b>{i.name}</b>
                <small>
                  {i.group} · {money(i.price)} ₽ / {i.unit} · сложность ×{" "}
                  {i.complexity}
                </small>
              </span>
              <input
                aria-label={`Количество: ${i.name}`}
                type="number"
                min="0"
                max="100000"
                value={quantities[i.id] || ""}
                placeholder="0"
                onChange={(e) =>
                  setQuantities({
                    ...quantities,
                    [i.id]: Math.max(0, Number(e.target.value)),
                  })
                }
              />
            </label>
          ))}
        </div>
        {catalog.works.map((w) => (
          <label className={ui("checkbox")} key={w.name}>
            <input
              type="checkbox"
              checked={works.includes(w.name)}
              onChange={(e) =>
                setWorks(
                  e.target.checked
                    ? [...works, w.name]
                    : works.filter((n) => n !== w.name),
                )
              }
            />
            <span>{w.name}</span>
            <small>{w.rate * 100}%</small>
          </label>
        ))}
        <div className={ui("detail-row")}>
          <span>Оборудование</span>
          <b>{money(equipment)} ₽</b>
        </div>
        <div className={ui("detail-row")}>
          <span>Работы до регионального коэффициента</span>
          <b>{money(labor)} ₽</b>
        </div>
        <p>
          Принятая формула: оборудование = Σ(количество × базовая цена); работы
          = Σ(количество × цена × сложность) × сумма ставок работ × уровень
          проекта. Региональный коэффициент применяется калькулятором к работам.
        </p>
        <button
          type="button"
          className={ui("button")}
          disabled={!equipment}
          onClick={() =>
            setInput({
              ...input,
              equipment,
              labor,
              units: Math.max(
                1,
                Object.values(quantities).reduce((a, b) => a + b, 0),
              ),
            })
          }
        >
          Перенести в параметры расчёта
        </button>
      </div>
    </details>
  );
}
