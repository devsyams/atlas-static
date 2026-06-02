import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// RTL's built-in afterEach(cleanup) runs before any describe-level afterEach,
// so it fires while vi.useFakeTimers() is still active — leaving stale DOM nodes
// across tests. We disable auto-cleanup and handle it here, AFTER restoring real
// timers, so React can flush pending effects during unmount.
process.env.RTL_SKIP_AUTO_CLEANUP = "true";
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});
