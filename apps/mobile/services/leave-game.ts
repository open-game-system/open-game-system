import type { InstanceReport } from "@open-game-system/ogs-protocol";

export interface ReturnPill {
  appId: string | null;
  name: string;
  url: string;
  at: number;
}

/**
 * What a completed swipe back from a game does (a cancelled swipe never gets here).
 * - cast: `home`, so the session pauses the game and the launcher shows its box again;
 * - a game that never reported itself: a Tier 0 `visit` (one stable id per game, so visits
 *   collapse to a single Continue entry);
 * - always: the "Rejoin" return pill.
 */
export function leaveGame(input: {
  appId: string | null;
  name: string;
  url: string;
  ogsCast: boolean;
  reported: boolean;
  now: number;
}): { home: boolean; visit: InstanceReport | null; pill: ReturnPill } {
  const { appId, name, url, ogsCast, reported, now } = input;
  const visit: InstanceReport | null =
    appId && !reported
      ? {
          instanceId: `visit-${appId}`,
          appId,
          status: "suspended",
          title: name,
          detail: "",
          resumeUrl: /^https?:\/\//.test(url) ? url : undefined,
        }
      : null;
  return { home: ogsCast, visit, pill: { appId, name, url, at: now } };
}
