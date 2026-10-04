// "Window to the TV": the iPad shows a slice of the very same console world that is on the TV.
// These are the TV's own lists, so both screens always agree on which tiles are where.
import { GAMES, gameById } from "../../../world";
import { couchShelf } from "../activities";
import type { S } from "../state";

/** The console home's shelf (as TvHome draws it) and its focused game. */
export function homeShelf(s: S): { games: string[]; focus: string | null } {
  const couch = couchShelf(s).filter((a) => gameById(a.gameId).shape === "couch" && !!gameById(a.gameId).art.tv);
  const focus = couch.find((a) => a.gameId === s.tvFocus) ?? couch[0];
  return { games: couch.slice(0, 5).map((a) => a.gameId), focus: focus ? focus.gameId : null };
}

/** The paused TV's "Up next" shelf (as TvPaused draws it). */
export const nextShelf = (gameId: string): string[] => GAMES.filter((x) => x.shape === "couch" && x.id !== gameId).map((x) => x.id);
