"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scoreColor } from "@/lib/mbg/colors";
import type { CityMapPoint } from "@/lib/mbg/types";

const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [
  [-11.5, 94.0],
  [6.5, 141.5],
];

function escapeHtml(text: string): string {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function IncidentMap({
  points,
  selectedCityKey,
  onSelectCity,
}: {
  points: CityMapPoint[];
  selectedCityKey: string | null;
  onSelectCity: (key: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectCity);
  onSelectRef.current = onSelectCity;

  // Initialise the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    map.fitBounds(INDONESIA_BOUNDS);
    map.setMaxBounds(INDONESIA_BOUNDS);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 10,
      minZoom: 4,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw markers whenever the points change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    points.forEach((location) => {
      if (typeof location.lat !== "number" || typeof location.lng !== "number") return;
      const color = scoreColor(Math.min(10, location.severity_sum || 1));
      const baseR = Math.max(130000, Math.min(420000, (location.heat || 1) * 600));

      // Soft radial heat fill: stacked translucent circles, brightest at the centre.
      (
        [
          [1, 0.1],
          [0.62, 0.16],
          [0.32, 0.26],
        ] as [number, number][]
      ).forEach(([rf, op], idx) => {
        L.circle([location.lat, location.lng], {
          radius: baseR * rf,
          stroke: idx === 0,
          color,
          weight: 0.6,
          opacity: 0.3,
          fillColor: color,
          fillOpacity: op,
          className: "incident-blob",
          interactive: true,
        })
          .addTo(layer)
          .on("click", () => onSelectRef.current(location.city_key));
      });

      // Invisible centre anchor: reliable click target + popup.
      const anchor = L.circleMarker([location.lat, location.lng], {
        radius: 12,
        opacity: 0,
        fillOpacity: 0.01,
        fillColor: color,
        color,
      }).addTo(layer);
      anchor.bindPopup(
        `<div class="pin-popup-title">${escapeHtml(location.city)}, ${escapeHtml(location.province)}</div>` +
          `<div class="pin-popup-meta">${location.article_count} artikel · isu utama ${escapeHtml(location.dominant_issue)} · bobot ${location.heat}</div>`,
      );
      anchor.on("click", () => onSelectRef.current(location.city_key));
      bounds.push([location.lat, location.lng]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
      map.setMaxBounds(INDONESIA_BOUNDS);
    }
  }, [points]);

  // Fly to the selected city.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCityKey) return;
    const active = points.find((p) => p.city_key === selectedCityKey);
    if (!active) return;
    map.flyTo([active.lat, active.lng], Math.max(map.getZoom(), 6), { duration: 0.35 });
  }, [selectedCityKey, points]);

  return <div ref={containerRef} className="h-full min-h-[180px] w-full" />;
}
