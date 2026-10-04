import type { CurrentGame, Screen } from "@open-game-system/ogs-protocol";

/**
 * How long the TV waits for a started game's TV page (its phone page sends game.view) before it
 * says the game didn't open here. Overridable with `?viewTimeout=` (params.ts), like frameTimeout.
 */
export const VIEW_TIMEOUT_MS = 20_000;

/**
 * The sitting still waiting for its TV page, keyed by when it started (a Continue of the same
 * sitting is a new wait), or null when nothing is waiting.
 */
export function waitingForView(screen: Screen, current: CurrentGame | null): string | null {
  if (screen !== "game" || !current || current.viewUrl) return null;
  return `${current.instanceId}@${current.startedAt}`;
}

export type PlayerCard = "starting" | "no-view" | "frame-failed" | null;

/** What the player says over the game: Getting ready, didn't open (no TV page / no load), or nothing. */
export function playerCard(s: {
  shown: boolean;
  game: boolean;
  active: boolean;
  frameFailed: boolean;
  viewOverdue: boolean;
}): PlayerCard {
  if (!s.shown || !s.game) return null;
  if (!s.active) return s.viewOverdue ? "no-view" : "starting";
  return s.frameFailed ? "frame-failed" : null;
}

/** The didn't-open card: the game is up on the phone but never sent the TV its page. */
export function noViewCopy(gameName: string, remoteHolder: string | null) {
  const phone = remoteHolder ? `${remoteHolder}'s phone` : "your phone";
  return {
    eyebrow: "Couldn't open",
    line: `${gameName} didn't open on the TV`,
    sub: `Press Home on ${phone} to come back`,
  };
}
