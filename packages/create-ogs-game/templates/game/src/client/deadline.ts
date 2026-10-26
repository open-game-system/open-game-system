import { useEffect, useState } from "react";

/** Seconds left until `endsAt` (ms since epoch), ticking; null without a deadline. */
export function useSecondsLeft(endsAt: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/**
 * A sleeping room never wakes by itself: once a deadline is half a second past, send TICK (once per
 * deadline). The room checks it against its own clock.
 */
export function useTickAfter(endsAt: number | null, tick: () => void): void {
  useEffect(() => {
    if (endsAt === null) return;
    const id = setTimeout(tick, Math.max(0, endsAt - Date.now()) + 500);
    return () => clearTimeout(id);
  }, [endsAt, tick]);
}
