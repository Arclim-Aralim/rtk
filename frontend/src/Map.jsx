import { ui } from "./ui";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
export default function Map({
  points,
  onSelect,
  heat = false,
  selected,
  onZone,
  bounds = "",
}) {
  const root = useRef(null),
    map = useRef(null),
    markers = useRef(null);
  const zoneLayer = useRef(null),
    zoneCallback = useRef(onZone);
  zoneCallback.current = onZone;
  const [drawing, setDrawing] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const mapPoints = points.flatMap((p) => {
    if ("mapLocations" in p && p.mapLocations)
      return p.mapLocations.map((loc) => ({
        ...p,
        mapAccuracy: loc.accuracy,
        lat: loc.lat,
        lon: loc.lon,
        mapLabel: `${p.name} · ${loc.kind === "operations" ? "Площадка деятельности" : "Место регистрации"} · ${loc.label ?? ""}`,
      }));
    return p.lat != null && p.lon != null
      ? [
          {
            ...p,
            lat: p.lat,
            lon: p.lon,
            mapLabel: p.name,
            mapAccuracy: p.geoAccuracy,
          },
        ]
      : [];
  });
  useEffect(() => {
    if (!root.current) return;
    const instance = L.map(root.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([47.23, 39.72], 8);
    map.current = instance;
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://www.geonames.org/">GeoNames</a> (CC BY 4.0)',
    })
      .on("tileerror", () => setTilesUnavailable(true))
      .addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (zoneLayer.current) {
      zoneLayer.current.remove();
      zoneLayer.current = null;
    }
    if (bounds) {
      const [a, b, c, d] = bounds.split(",").map(Number);
      zoneLayer.current = L.rectangle(
        [
          [a, b],
          [c, d],
        ],
        { color: "#7700FF", weight: 2, fillOpacity: 0.04, interactive: false },
      ).addTo(instance);
    }
  }, [bounds]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !drawing) return;
    let start = null;
    const click = (event) => {
      if (!start) {
        start = event.latlng;
        return;
      }
      const end = event.latlng;
      const area = L.latLngBounds(start, end);
      zoneCallback.current?.(
        [area.getSouth(), area.getWest(), area.getNorth(), area.getEast()].join(
          ",",
        ),
      );
      setDrawing(false);
    };
    const move = (event) => {
      if (!start) return;
      if (zoneLayer.current) zoneLayer.current.remove();
      zoneLayer.current = L.rectangle(L.latLngBounds(start, event.latlng), {
        color: "#7700FF",
        weight: 2,
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(instance);
    };
    instance.on("click", click);
    instance.on("mousemove", move);
    instance.getContainer().classList.add("cursor-crosshair!");
    return () => {
      instance.off("click", click);
      instance.off("mousemove", move);
      instance.getContainer().classList.remove("cursor-crosshair!");
    };
  }, [drawing]);
  useEffect(() => {
    const instance = map.current,
      group = markers.current;
    if (!instance || !group) return;
    group.clearLayers();
    mapPoints.forEach((p) => {
      const company = "revenue" in p,
        active = p.id === selected,
        color = company ? (p.client ? "#7700FF" : "#FF4F12") : "#7700FF";
      if (heat && company && p.revenue != null)
        L.circle([p.lat, p.lon], {
          radius: Math.max(3000, Math.sqrt(p.revenue) * 450),
          color,
          weight: 0,
          fillOpacity: 0.09,
        }).addTo(group);
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: active
          ? 11
          : company && p.revenue != null
            ? 6 + Math.sqrt(p.revenue) / 14
            : 8,
        color: active ? "#101828" : "white",
        weight: active ? 3 : 2,
        fillColor: color,
        fillOpacity: 0.9,
      });
      const label = document.createElement("span");
      label.textContent =
        p.mapLabel +
        (p.mapAccuracy === "locality"
          ? " · Примерно: центр населённого пункта"
          : p.mapAccuracy === "district"
            ? " · Примерно: точка района"
            : "");
      marker.bindTooltip(label, { direction: "top" });
      marker.on("click", () => onSelect?.(p.id));
      marker.addTo(group);
    });
    if (mapPoints.length)
      instance.fitBounds(L.latLngBounds(mapPoints.map((p) => [p.lat, p.lon])), {
        padding: [45, 45],
        maxZoom: 10,
      });
  }, [points, heat, selected, onSelect]);
  return (
    <div className={ui("map-wrap")}>
      <div
        ref={root}
        className={ui("map-canvas")}
        role="region"
        aria-label="Интерактивная карта объектов"
      />
      {onZone && (
        <div className={ui("zone-tools")}>
          <button
            onClick={() => {
              if (bounds) {
                onZone("");
                setDrawing(false);
              } else setDrawing(!drawing);
            }}
          >
            {bounds
              ? "Сбросить зону"
              : drawing
                ? "Отменить выделение"
                : "Выбрать зону"}
          </button>
          {drawing && <span>Укажите два противоположных угла на карте</span>}
        </div>
      )}
      {tilesUnavailable && (
        <div className={ui("map-notice")}>
          Подложка карты недоступна. Объекты и масштабирование работают.
        </div>
      )}
      {!mapPoints.length && (
        <div className={ui("map-empty")}>
          {points.length
            ? "Координаты объектов не подтверждены. Записи доступны в таблице."
            : "Нет объектов по выбранным фильтрам"}
        </div>
      )}
      <div className={ui("map-caption")}>
        Прокрутка карты: перетаскивание · Масштаб: + / −
      </div>
    </div>
  );
}
