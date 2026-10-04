import type { ClientMessage, Manifest, SuspendedGame } from "@open-game-system/ogs-protocol";
import type { Dir } from "./focus-grid";

/**
 * Cards that aren't a game's page. The protocol's `select` only opens `game:<id>` items (as a
 * page), so these cards are `game:~…` items: the session opens them as page `~…`, and the
 * launcher turns that page into a `game.start` at once. `~` never appears in an appId.
 */
export const SURPRISE_ITEM = "game:~surprise";
export const continueItem = (appId: string, instanceId: string) =>
  `game:~continue:${appId}:${instanceId}`;

export type Shortcut =
  | { kind: "surprise" }
  | { kind: "continue"; appId: string; instanceId: string };

export function readShortcut(page: string | null): Shortcut | null {
  if (page === "~surprise") return { kind: "surprise" };
  const m = page ? /^~continue:([a-z0-9-]+):(.+)$/.exec(page) : null;
  return m?.[1] && m[2] ? { kind: "continue", appId: m[1], instanceId: m[2] } : null;
}

/** The game.start an opened shortcut becomes, on the remote holder's phone. */
export function shortcutStart(
  shortcut: Shortcut,
  ctx: { surprise: string | null; suspended: SuspendedGame[]; remote: string | null },
): ClientMessage | null {
  const host = ctx.remote ? { hostDeviceId: ctx.remote } : {};
  if (shortcut.kind === "continue")
    return {
      type: "game.start",
      appId: shortcut.appId,
      mode: "continue",
      instanceId: shortcut.instanceId,
      ...host,
    };
  const appId = ctx.surprise;
  if (!appId) return null;
  const paused = ctx.suspended.some((g) => g.appId === appId);
  return { type: "game.start", appId, mode: paused ? "continue" : "new", ...host };
}

/** A random game for the kids: not the one just played, when there is another. */
export function pickSurprise(
  games: Pick<Manifest, "appId">[],
  recent: string | null,
  rand: () => number,
): string | null {
  const others = games.filter((g) => g.appId !== recent);
  const pool = others.length > 0 ? others : games;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]?.appId ?? null;
}

/** On a paused game's page the remote moves between Continue and Start game; null = stay. */
export function pageMove(focus: string | null, dir: Dir, paused: boolean): string | null {
  if (!paused) return null;
  const onStart = focus === "action:new";
  if (dir === "right" && !onStart) return "action:new";
  if (dir === "left" && onStart) return "action:continue";
  return null;
}
