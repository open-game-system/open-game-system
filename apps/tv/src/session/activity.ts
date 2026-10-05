import type { SessionState } from "@open-game-system/ogs-protocol";
import type { SessionClient } from "./client";

/** How often the launcher re-marks activity while a phone or tablet is on the couch session. */
export const ACTIVITY_TICK_MS = 30 * 1000;

/** Where the stream server looks: `window.__ogsActivityAt` on the page it renders (this one). */
export interface ActivityTarget {
  __ogsActivityAt?: number;
}

const controllerOnline = (state: SessionState | null) =>
  !!state?.devices.some((d) => d.kind !== "launcher" && d.online);

/**
 * Keeps `__ogsActivityAt` (ms since epoch) at the last time players were around, so the stream
 * server's idle stop (20 minutes, services/api/container/src/stream-lifetime.ts) ends a cast left
 * on with nobody playing. Players are around while any phone or tablet is on the couch session,
 * and whenever the session changes (a game starts, someone joins) or the remote is pressed.
 * Games run in frames this page can't see into; their players' phones keep the session open.
 */
export function watchActivity(
  client: SessionClient,
  opts: {
    target: ActivityTarget;
    now?: () => number;
    every?: (fn: () => void, ms: number) => () => void;
  },
): () => void {
  const now = opts.now ?? Date.now;
  const every =
    opts.every ??
    ((fn, ms) => {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    });
  const mark = () => {
    opts.target.__ogsActivityAt = now();
  };
  let seen = JSON.stringify(client.getSnapshot().state);
  mark();
  const unsubscribe = client.subscribe(() => {
    const state = JSON.stringify(client.getSnapshot().state);
    if (state === seen) return;
    seen = state;
    mark();
  });
  const unmove = client.onFocusMove(mark);
  const stopTick = every(() => {
    if (controllerOnline(client.getSnapshot().state)) mark();
  }, ACTIVITY_TICK_MS);
  return () => {
    unsubscribe();
    unmove();
    stopTick();
  };
}
