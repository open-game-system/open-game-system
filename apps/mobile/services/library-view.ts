import type { Instance, Manifest, SessionState } from "@open-game-system/ogs-protocol";

const isOpen = (i: Instance, now: number, ttl: number) =>
  i.status !== "completed" && i.status !== "expired" && now - i.updatedAt <= ttl;

/** The one line under a Library tile: where this game is for this profile right now. */
export function gameStatusLine(
  game: Manifest,
  instances: Instance[],
  session: SessionState | null,
  now: number,
): string {
  const newest = instances
    .filter((i) => i.appId === game.appId && isOpen(i, now, game.instanceTtlMs))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return couchLine(game, session) ?? (newest ? instanceLine(newest) : "New");
}

/** On the TV, or paused on the couch (with its resume point). */
function couchLine(game: Manifest, session: SessionState | null): string | null {
  if (session?.current?.appId === game.appId) return "On the TV now";
  const paused = session?.suspended.find((g) => g.appId === game.appId);
  if (!paused) return null;
  return paused.label ? `In progress · ${paused.label}` : "In progress";
}

/** The profile's newest open instance: your turn, its title, or just in progress. */
function instanceLine(newest: Instance): string {
  const label = newest.title || newest.detail;
  if (newest.status === "waiting" && newest.yourTurn)
    return label ? `Your turn · ${label}` : "Your turn";
  return label || "In progress";
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
