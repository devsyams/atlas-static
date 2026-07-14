"use client";

import { useEffect, useState } from "react";

/**
 * A12 v2.0 — the Nexorus AI (LLM) kill switch (AC9).
 *
 * Cost control for an unattended demo. When off, the browser never calls the
 * LLM-backed routes at all, so **no tokens are spent** — this is a real switch,
 * not a UI-only badge. Persisted in localStorage; defaults to on.
 *
 * Client-side by design: these routes are only ever called by our own UI, and
 * the demo has no DB to hold a server-side flag. If this is ever productized,
 * move the flag server-side and gate the route too.
 */

const KEY = "nexorus.ai.enabled";
const EVENT = "nexorus:ai-settings";

export function isAiEnabled(): boolean {
  if (typeof window === "undefined") return true; // SSR: assume on, the hook corrects it
  return window.localStorage.getItem(KEY) !== "0";
}

export function setAiEnabled(on: boolean): void {
  window.localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVENT));
}

/** Reactive read of the switch — re-renders every consumer when it flips. */
export function useAiEnabled(): boolean {
  // Start `true` so server and first client render agree (no hydration mismatch);
  // the effect immediately corrects it from localStorage.
  const [on, setOn] = useState(true);

  useEffect(() => {
    const sync = () => setOn(isAiEnabled());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync); // another tab flipped it
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return on;
}
