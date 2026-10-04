import { useSyncExternalStore } from "react";

/** Wall-clock time, refreshed every 15 s (enough for a clock and "Paused at 7:02"). */
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  timer ??= setInterval(() => {
    now = Date.now();
    for (const l of listeners) l();
  }, 15_000);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export const useNow = () => useSyncExternalStore(subscribe, () => now);
