import type { InstanceReport } from "@open-game-system/ogs-protocol";

export interface ReturnPill {
  appId: string | null;
  name: string;
  url: string;
  at: number;
  /** The sitting it points back into, when known. */
  instanceId?: string;
}

/**
 * What a completed swipe back from a game does (a cancelled swipe never gets here).
 * - cast: `home`, so the session pauses the game and the launcher shows its box again (not from a
 *   phone following someone else's game, nor when the TV already went Home: `parks` false);
 * - a game that never reported itself: a Tier 0 `visit` under its sitting's id (so two games of
 *   one title stay two, and returning to one sitting updates it), or one stable id per game when
 *   the sitting is unknown;
 * - always: the "Rejoin" return pill.
 */
export function leaveGame(input: {
  appId: string | null;
  name: string;
  url: string;
  ogsCast: boolean;
  reported: boolean;
  now: number;
  /** The sitting the screen holds (see game-rejoin `sittingId`). */
  instanceId?: string | null;
  /**
   * Whether leaving parks the game on the TV (default true). False for a phone following someone
   * else's game, which steps out to the remote, and when the TV itself closed the game (Home).
   */
  parks?: boolean;
}): { home: boolean; visit: InstanceReport | null; pill: ReturnPill } {
  const { appId, name, url, ogsCast, reported, now, parks = true } = input;
  const instanceId = input.instanceId ?? undefined;
  const visit: InstanceReport | null =
    appId && !reported
      ? {
          instanceId: instanceId ?? `visit-${appId}`,
          appId,
          status: "suspended",
          title: name,
          detail: "",
          resumeUrl: /^https?:\/\//.test(url) ? url : undefined,
        }
      : null;
  return { home: ogsCast && parks, visit, pill: { appId, name, url, at: now, instanceId } };
}
