"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scoreColor } from "@/lib/mbg/colors";
import type { CityMapPoint } from "@/lib/mbg/types";

const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [
  [-11.5, 94.0],
  [6.5, 141.5],
];
const GEO_URL = "/geo/idn-provinces.geojson";
const EMPTY_FILL = "oklch(0.34 0.02 260)";
const EMPTY_STROKE = "oklch(0.46 0.03 265)";

function escapeHtml(text: string): string {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Normalise province names so the data matches the GeoJSON `state` field. */
function canonProvince(s: string): string {
  let x = (s || "").toLowerCase().replace(/[^a-z]/g, "");
  x = x.replace(/^(dki|di|provinsi|prov)/, "");
  if (x.includes("jakarta")) return "jakarta";
  if (x.includes("yogya") || x.includes("jogja")) return "yogyakarta";
  if (x.includes("bangka")) return "bangkabelitung";
  return x;
}

interface ProvInfo {
  severity: number;
  articles: number;
  issue: string;
  topKey: string;
  topHeat: number;
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
  const geoRef = useRef<L.GeoJSON | null>(null);
  const pulseRef = useRef<L.LayerGroup | null>(null);
  const geoDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const onSelectRef = useRef(onSelectCity);
  onSelectRef.current = onSelectCity;
  const [geoReady, setGeoReady] = useState(false);

  // Initialise the map + load province polygons once.
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
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    const t = setTimeout(() => map.invalidateSize(), 120);

    let cancelled = false;
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((d: GeoJSON.FeatureCollection) => {
        if (!cancelled) {
          geoDataRef.current = d;
          setGeoReady(true);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      geoRef.current = null;
    };
  }, []);

  // Build / rebuild the choropleth when data, polygons, or selection change.
  useEffect(() => {
    const map = mapRef.current;
    const data = geoDataRef.current;
    if (!map || !data) return;

    if (geoRef.current) {
      geoRef.current.remove();
      geoRef.current = null;
    }

    const byProv = new Map<string, ProvInfo>();
    for (const p of points) {
      const key = canonProvince(p.province);
      const sev = Math.min(10, p.severity_sum || 0);
      const cur = byProv.get(key);
      if (!cur) {
        byProv.set(key, {
          severity: sev,
          articles: p.article_count || 0,
          issue: p.dominant_issue || "—",
          topKey: p.city_key,
          topHeat: p.heat || 0,
        });
      } else {
        cur.severity = Math.max(cur.severity, sev);
        cur.articles += p.article_count || 0;
        if ((p.heat || 0) >= cur.topHeat) {
          cur.topHeat = p.heat || 0;
          cur.topKey = p.city_key;
          cur.issue = p.dominant_issue || cur.issue;
        }
      }
    }

    const selectedProv = (() => {
      const sp = points.find((p) => p.city_key === selectedCityKey);
      return sp ? canonProvince(sp.province) : null;
    })();

    const styleFor = (state: string): L.PathOptions => {
      const info = byProv.get(canonProvince(state));
      if (!info) {
        return {
          color: EMPTY_STROKE,
          weight: 0.6,
          opacity: 0.4,
          fillColor: EMPTY_FILL,
          fillOpacity: 0.12,
        };
      }
      const c = scoreColor(info.severity);
      const sel = canonProvince(state) === selectedProv;
      return {
        color: sel ? "#ffffff" : c,
        weight: sel ? 2 : 1,
        opacity: sel ? 0.95 : 0.55,
        fillColor: c,
        fillOpacity: sel ? 0.7 : 0.45,
      };
    };

    const gl = L.geoJSON(data, {
      style: (feature) => styleFor(feature?.properties?.state ?? ""),
      onEachFeature: (feature, layer) => {
        const info = byProv.get(canonProvince(feature?.properties?.state ?? ""));
        if (!info) return;
        layer.bindPopup(
          `<div class="pin-popup-title">${escapeHtml(feature.properties.state)}</div>` +
            `<div class="pin-popup-meta">${info.articles} artikel · isu utama ${escapeHtml(info.issue)}</div>`,
        );
        layer.on("click", () => onSelectRef.current(info.topKey));
        layer.on("mouseover", () => (layer as L.Path).setStyle({ weight: 2, fillOpacity: 0.62 }));
        layer.on("mouseout", () => geoRef.current?.resetStyle(layer as L.Path));
      },
    });
    gl.addTo(map);
    geoRef.current = gl;

    // Pulsing threat markers on the top hotspots.
    if (pulseRef.current) {
      pulseRef.current.remove();
      pulseRef.current = null;
    }
    const hotspots = [...points].sort((a, b) => (b.heat || 0) - (a.heat || 0)).slice(0, 3);
    if (hotspots.length) {
      const group = L.layerGroup();
      for (const p of hotspots) {
        const color = scoreColor(Math.min(10, p.severity_sum || 0));
        const icon = L.divIcon({
          className: "",
          html:
            `<span class="threat-pulse" style="--c:${color}">` +
            `<span class="ring"></span><span class="ring delay"></span><span class="dot"></span></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([p.lat, p.lng], { icon, interactive: false, keyboard: false }).addTo(group);
      }
      group.addTo(map);
      pulseRef.current = group;
    }
  }, [points, geoReady, selectedCityKey]);

  // Fly to the selected city's province.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCityKey) return;
    const active = points.find((p) => p.city_key === selectedCityKey);
    if (!active) return;
    map.flyTo([active.lat, active.lng], Math.max(map.getZoom(), 6), { duration: 0.35 });
  }, [selectedCityKey, points]);

  return <div ref={containerRef} className="h-full min-h-[180px] w-full" />;
}
