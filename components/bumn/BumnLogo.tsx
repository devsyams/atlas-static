"use client";

import Image from "next/image";
import { useState } from "react";

/** Stable monogram background from a key (logo fallback). */
function monogramColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `oklch(0.5 0.13 ${h})`;
}

/**
 * A BUMN logo: the real asset at `/public/bumn/{slug}.png`, falling back to a
 * monogram (initials from `short`) when the asset is missing. Shared by the CEO
 * heatboard tiles and the per-BUMN dashboard. `size` is the px box edge.
 */
export function BumnLogo({
  slug,
  name,
  short,
  colorKey,
  size = 36,
  className = "",
}: {
  slug: string;
  name: string;
  short: string;
  colorKey?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = short.replace(/\s+/g, "").slice(0, 4).toUpperCase();
  const box = { width: size, height: size };
  return (
    <span data-testid="bumn-logo" className={`inline-flex shrink-0 ${className}`}>
      {failed ? (
        <span
          aria-label={name}
          className="flex items-center justify-center rounded-md font-extrabold tracking-tight text-white"
          style={{ ...box, backgroundColor: monogramColor(colorKey || slug), fontSize: size * 0.34 }}
        >
          {initials}
        </span>
      ) : (
        <Image
          src={`/bumn/${slug}.png`}
          alt={`${name} logo`}
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="rounded-md bg-white/90 object-contain p-0.5"
          style={box}
        />
      )}
    </span>
  );
}
