import type { Instance, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { type Sitting, sittingsFor } from "../../../services/sittings";

/** The Library's big game: what you played last (or what's on the TV now), else your first game. */
export interface LibraryHero {
  game: Manifest;
  /** The sitting its primary action rejoins; null means the action starts a new game. */
  sitting: Sitting | null;
  /** When it was last played; null when never. */
  playedAt: number | null;
}

/** The Library, Steam-style: one hero (a feature, not a move), then All Games in library order. */
export interface LibraryShelves {
  hero: LibraryHero | null;
  grid: Manifest[];
}

/** When `game` was last played: its newest instance (finished or not) or couch-session sitting. */
function lastPlayed(game: Manifest, instances: Instance[], session: SessionState | null) {
  const times = [
    ...instances.filter((i) => i.appId === game.appId).map((i) => i.updatedAt),
    ...(session?.current?.appId === game.appId ? [session.current.startedAt] : []),
    ...(session?.suspended ?? []).filter((g) => g.appId === game.appId).map((g) => g.at),
  ];
  return times.length > 0 ? Math.max(...times) : null;
}

export function libraryShelves(
  library: Manifest[],
  instances: Instance[],
  session: SessionState | null,
  now: number,
): LibraryShelves {
  if (library.length === 0) return { hero: null, grid: [] };
  const played = library
    .map((game) => ({ game, at: lastPlayed(game, instances, session) }))
    .filter((p): p is { game: Manifest; at: number } => p.at !== null)
    .sort((a, b) => b.at - a.at);
  const live = played.find((p) => p.game.appId === session?.current?.appId);
  const ordered = live ? [live, ...played.filter((p) => p !== live)] : played;
  const top = ordered[0];
  const heroGame = top?.game ?? library[0];
  return {
    hero: {
      game: heroGame,
      sitting: sittingsFor(heroGame, instances, session, now)[0] ?? null,
      playedAt: top?.at ?? null,
    },
    grid: library,
  };
}

/**
 * What the hero says above its art: "On the TV now", the resume point its Rejoin goes back to, or
 * "Last played" (its role, not a time: Library shows games, the Playing tab their state).
 */
export function heroEyebrow(hero: LibraryHero): string | null {
  if (hero.sitting?.live) return "On the TV now";
  if (hero.sitting?.label) return hero.sitting.label;
  return hero.playedAt === null ? null : "Last played";
}

/**
 * The hero's one button, with the verb the game's page uses: Rejoin its newest sitting, else Play.
 * Either one asks to cast first when the game needs the TV and it isn't cast (see play-action).
 */
export function heroAction(hero: LibraryHero): "rejoin" | "play" {
  return hero.sitting ? "rejoin" : "play";
}
