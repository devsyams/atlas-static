"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeatureGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentItem, RouteSegment } from "@/lib/jasamarga/types";
import type { Corridor } from "@/lib/jasamarga/corridors";
import { corridorPath, segmentPath, snapToPath } from "@/lib/jasamarga/geo";
import { FLOW_COLORS } from "@/lib/jasamarga/ui";

interface Props {
  corridor: Corridor;
  segments: RouteSegment[];
  incidents: IncidentItem[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}

export function CorridorMap({ corridor, segments, incidents, selected, onSelect }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const groupRef = useRef<FeatureGroup | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Repaint the corridor + incident layers from the latest props. Reads Leaflet
  // refs (only ever invoked from effects, never during render).
  const draw = useCallback(() => {
    const L = LRef.current;
    const group = groupRef.current;
    if (!L || !group) return;
    group.clearLayers();

    // One colored line per ruas — the congestion color is the whole message.
    segments.forEach((seg, i) => {
      const isSel = selected === i;
      L.polyline(segmentPath(corridor, i), {
        color: FLOW_COLORS[seg.status],
        weight: isSel ? 9 : 6,
        opacity: isSel ? 1 : 0.85,
        lineCap: "round",
      })
        .on("click", () => onSelect(isSel ? null : i))
        .bindTooltip(`${seg.label} · ${seg.speed} km/j · +${seg.delay_min} mnt`, { sticky: true })
        .addTo(group);
    });

    // Snap every marker onto the corridor we actually drew. Live TomTom incidents
    // carry real road coordinates, but this line is an anchor approximation of the
    // road — plotted raw, the dots float beside it. The popup keeps the true KM.
    const road = corridorPath(corridor);

    incidents.forEach((inc) => {
      if (inc.lat == null || inc.lng == null) return;
      const at = snapToPath(road, [inc.lat, inc.lng]);
      const color = inc.severity >= 7 ? FLOW_COLORS.lumpuh : inc.severity >= 4 ? FLOW_COLORS.macet : FLOW_COLORS.padat;
      L.circleMarker(at, {
        radius: 6,
        color: "oklch(0.97 0.02 240)",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(
          `<strong>${inc.type}</strong> · ${inc.km}<br/>${inc.status} · sumber ${inc.source}` +
            (inc.lanes_blocked ? `<br/>${inc.lanes_blocked} lajur tertutup` : ""),
        )
        .addTo(group);
    });
  }, [corridor, segments, incidents, selected, onSelect]);

  // Init the map once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !elRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(elRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap, &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      // Cinematic reveal: open tight on Halim, then pull back to the full corridor.
      const bounds = L.latLngBounds(corridorPath(corridor));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        map.fitBounds(bounds, { padding: [28, 28] });
      } else {
        map.setView(corridorPath(corridor)[0], 12, { animate: false });
        map.flyToBounds(bounds, { padding: [28, 28], duration: 2.6 });
      }
      groupRef.current = L.featureGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
      setReady(false);
    };
    // Mount-once cinematic reveal seeded from the initial corridor; later corridor
    // changes are handled by the dedicated fly-to effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever data/selection changes, once the map is ready.
  useEffect(() => {
    if (!ready) return;
    draw();
    if (selected != null && mapRef.current) {
      const pts = segmentPath(corridor, selected);
      mapRef.current.panTo(pts[1], { animate: true });
    }
  }, [ready, draw, selected, corridor]);

  // Fly to a newly selected corridor (after the initial reveal).
  const corridorIdRef = useRef(corridor.id);
  useEffect(() => {
    if (!ready) return;
    if (corridorIdRef.current === corridor.id) return;
    corridorIdRef.current = corridor.id;
    const map = mapRef.current;
    const L = LRef.current;
    if (map && L) {
      map.flyToBounds(L.latLngBounds(corridorPath(corridor)), { padding: [28, 28], duration: 1.8 });
    }
  }, [ready, corridor]);

  return <div className="jm-map h-full w-full"><div ref={elRef} className="h-full w-full" /></div>;
}
