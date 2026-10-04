import type { Manifest } from "@open-game-system/ogs-protocol";
import type { Dir } from "./focus-grid";

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
