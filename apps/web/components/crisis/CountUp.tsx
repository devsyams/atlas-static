"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from its previous value up to `value` (easeOutCubic). */
export function CountUp({
  value,
  duration = 1100,
  decimals = 0,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString("id-ID");

  return <span className={className}>{text}</span>;
}
