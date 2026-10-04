import type { Instance, Manifest, SessionState } from "@open-game-system/ogs-protocol";

const isOpen = (i: Instance, now: number, ttl: number) =>
  i.status !== "completed" && i.status !== "expired" && now - i.updatedAt <= ttl;

/** The one line under a Library tile: where this game is for the household right now. */
export function gameStatusLine(
  game: Manifest,
  instances: Instance[],
  session: SessionState | null,
  now: number,
): string {
  if (session?.current?.appId === game.appId) return "On the TV now";
  const paused = session?.suspended.find((g) => g.appId === game.appId);
  if (paused) return `Paused · ${paused.label}`;
  const newest = instances
    .filter((i) => i.appId === game.appId && isOpen(i, now, game.instanceTtlMs))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!newest) return "New";
  const label = newest.title || newest.detail;
  if (newest.status === "waiting" && newest.yourTurn)
    return label ? `Your turn · ${label}` : "Your turn";
  return label || "Paused";
}

/**
 * Spec v3, When nothing's going: Playing suggests what to start now and what you played last.
 * Last played first, then games that fit the moment (TV games when cast, phone games when not),
 * then the rest, so a TV-only library still suggests something before casting.
 */
export function playingSuggestions(
  library: Manifest[],
  instances: Instance[],
  ogsCast: boolean,
): Manifest[] {
  const lastPlayed = [...instances].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const first = library.find((g) => g.appId === lastPlayed?.appId);
  const rest = library.filter((g) => g !== first);
  const fits = (g: Manifest) => (ogsCast ? g.tv !== "none" : g.tv !== "required");
  // What fits the moment first; TV games still show when not cast (they offer Cast to play).
  const ordered = [...rest.filter(fits), ...rest.filter((g) => !fits(g))];
  return [...(first ? [first] : []), ...ordered].slice(0, 3);
}
