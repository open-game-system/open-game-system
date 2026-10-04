import type { SessionState } from "@open-game-system/ogs-protocol";

export type TabName = "playing" | "tv" | "library";

/**
 * Spec v3, App structure: a cold start opens Playing only if a game this device was playing is
 * still live (the session's current game, hosted by or rostered to this phone); otherwise Library.
 */
export function openingTab(state: SessionState | null, deviceId: string): TabName {
  const current = state?.current;
  if (!current) return "library";
  const mine =
    current.hostDeviceId === deviceId || current.roster.some((r) => r.deviceId === deviceId);
  return mine ? "playing" : "library";
}

type StateSource = {
  getSnapshot(): { state: SessionState | null };
  subscribe(listener: () => void): () => void;
};

/** Wait (briefly) for the couch session's first state, then choose; silence means Library. */
export function decideOpeningTab(
  source: StateSource,
  deviceId: string,
  timeoutMs: number,
): Promise<TabName> {
  const now = source.getSnapshot().state;
  if (now) return Promise.resolve(openingTab(now, deviceId));
  return new Promise((resolve) => {
    const done = (tab: TabName) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(tab);
    };
    const unsubscribe = source.subscribe(() => {
      const state = source.getSnapshot().state;
      if (state) done(openingTab(state, deviceId));
    });
    const timer = setTimeout(() => done("library"), timeoutMs);
  });
}
