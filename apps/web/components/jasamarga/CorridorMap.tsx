"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeatureGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentItem, RouteSegment } from "@/lib/jasamarga/types";
import { corridorPath, segmentPath } from "@/lib/jasamarga/geo";
import { FLOW_COLORS, flowDuration } from "@/lib/jasamarga/ui";

interface Props {
  segments: RouteSegment[];
  incidents: IncidentItem[];
  selected: number | null;
  onSelect: (i: number | null) => void;
}

export function CorridorMap({ segments, incidents, selected, onSelect }: Props) {
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

    segments.forEach((seg, i) => {
      const isSel = selected === i;
      const path = segmentPath(i);
      // Neon under-glow in the congestion color (blurred halo beneath the road).
      L.polyline(path, {
        color: FLOW_COLORS[seg.status],
        weight: isSel ? 22 : 17,
        opacity: isSel ? 0.4 : 0.28,
        lineCap: "round",
        className: "jm-glow",
        interactive: false,
      }).addTo(group);
      // Base colored road — carries congestion color, click + tooltip.
      L.polyline(path, {
        color: FLOW_COLORS[seg.status],
        weight: isSel ? 9 : 6,
        opacity: isSel ? 1 : 0.85,
        lineCap: "round",
      })
        .on("click", () => onSelect(isSel ? null : i))
        .bindTooltip(`${seg.label} · ${seg.speed} km/j · +${seg.delay_min} mnt`, { sticky: true })
        .addTo(group);

      // Animated flow dashes on top — speed-reactive (fast traffic = fast flow).
      const flow = L.polyline(path, {
        color: "oklch(0.97 0.02 240)",
        weight: isSel ? 4 : 3,
        opacity: 0.85,
        className: "jm-flow",
        interactive: false,
      }).addTo(group);
      const flowEl = flow.getElement() as SVGPathElement | null;
      if (flowEl) flowEl.style.animationDuration = `${flowDuration(seg.speed)}s`;
    });

    incidents.forEach((inc) => {
      if (inc.lat == null || inc.lng == null) return;
      const color = inc.severity >= 7 ? FLOW_COLORS.lumpuh : inc.severity >= 4 ? FLOW_COLORS.macet : FLOW_COLORS.padat;
      const icon = L.divIcon({
        className: "",
        html: `<div class="jm-pin" style="--jm-pin-color:${color}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([inc.lat, inc.lng], { icon })
        .bindPopup(
          `<strong>${inc.type}</strong> · ${inc.km}<br/>${inc.status} · sumber ${inc.source}` +
            (inc.lanes_blocked ? `<br/>${inc.lanes_blocked} lajur tertutup` : ""),
        )
        .addTo(group);
    });
  }, [segments, incidents, selected, onSelect]);

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
      map.fitBounds(corridorPath(), { padding: [28, 28] });
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
  }, []);

  // Redraw whenever data/selection changes, once the map is ready.
  useEffect(() => {
    if (!ready) return;
    draw();
    if (selected != null && mapRef.current) {
      const pts = segmentPath(selected);
      mapRef.current.panTo(pts[1], { animate: true });
    }
  }, [ready, draw, selected]);

  return <div className="jm-map h-full w-full"><div ref={elRef} className="h-full w-full" /></div>;
}
