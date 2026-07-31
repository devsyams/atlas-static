"use client";

import { X } from "lucide-react";
import type { ConsoleOntology } from "@/lib/danantara/sim/console-types";
import { typeColor } from "@/lib/danantara/sim/graph-layout";

/**
 * Node detail panel (A15 v4.0). Clicking a node in the graph opens this: what the
 * entity is, and every relation it has — direction included, because `A CRITICIZES B`
 * and `B CRITICIZES A` are very different findings and the graph alone can't say which.
 *
 * Floats over the canvas rather than taking a column, so the graph stays the focus.
 */
export function NodeInspector({
  ontology,
  nodeId,
  onClose,
}: {
  ontology: ConsoleOntology;
  nodeId: string;
  onClose: () => void;
}) {
  const node = ontology.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const label = (id: string) => ontology.nodes.find((n) => n.id === id)?.label ?? id;
  const outgoing = ontology.edges.filter((e) => e.s === nodeId);
  const incoming = ontology.edges.filter((e) => e.t === nodeId);
  const typeIndex = new Map(ontology.entityTypes.map((t, i) => [t, i]));

  return (
    <div
      data-testid="node-inspector"
      className="absolute right-5 top-20 z-20 max-h-[65%] w-80 overflow-y-auto rounded-lg bg-white p-4 shadow-lg ring-1 ring-black/10"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
          style={{ background: typeColor(typeIndex, node.type) }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div data-testid="node-label" className="text-[15px] font-semibold leading-snug text-black">
            {node.label}
          </div>
          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-black/45">{node.type}</div>
        </div>
        <button
          type="button"
          data-testid="node-close"
          onClick={onClose}
          aria-label="Close node details"
          className="rounded p-1 text-black/35 hover:text-black"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-black/40">
        {outgoing.length + incoming.length} relations
      </div>

      <ul data-testid="node-relations" className="mt-2 space-y-1.5">
        {outgoing.map((e, i) => (
          <li key={`o${i}`} className="rounded bg-black/[0.03] px-2.5 py-2 text-[12.5px] leading-snug">
            <span className="font-mono text-[11px] text-[#c62b45]">{e.label}</span>{" "}
            <span className="text-black/45">→</span> <span className="text-black/80">{label(e.t)}</span>
          </li>
        ))}
        {incoming.map((e, i) => (
          <li key={`i${i}`} className="rounded bg-black/[0.03] px-2.5 py-2 text-[12.5px] leading-snug">
            <span className="text-black/80">{label(e.s)}</span> <span className="text-black/45">→</span>{" "}
            <span className="font-mono text-[11px] text-[#1f4e79]">{e.label}</span>
          </li>
        ))}
        {outgoing.length + incoming.length === 0 && (
          <li className="px-2.5 py-2 text-[12.5px] text-black/45">No relations extracted for this entity.</li>
        )}
      </ul>
    </div>
  );
}
