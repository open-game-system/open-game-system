import type { Instance, Manifest, SessionState } from "@open-game-system/ogs-protocol";

/** What sits at the right end of a Library row: Rejoin for a game in progress, else a chevron. */
export type RowAffordance = "rejoin" | "chevron";

/**
 * A game is in progress (owner: "a game you stepped out of") when it's live or paused on the
 * couch, the return pill points at it, or it has an open instance (same freshness rule as the
 * status line: not finished or expired, touched within the game's instance TTL).
 */
export function rowAffordance(
  game: Manifest,
  ctx: {
    instances: Instance[];
    session: SessionState | null;
    pillAppId: string | null;
    now: number;
  },
): RowAffordance {
  const { appId } = game;
  const { session, now } = ctx;
  const onCouch =
    session?.current?.appId === appId || !!session?.suspended.some((g) => g.appId === appId);
  const open = ctx.instances.some(
    (i) =>
      i.appId === appId &&
      i.status !== "completed" &&
      i.status !== "expired" &&
      now - i.updatedAt <= game.instanceTtlMs,
  );
  return onCouch || ctx.pillAppId === appId || open ? "rejoin" : "chevron";
}

/** The "Needs a TV" badge, as on Add games. */
export const needsTv = (game: Manifest): boolean => game.tv === "required";
