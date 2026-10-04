// Shelf swap: every couch game is a box on the family shelf. The box in the console is open (its
// game is on the TV); every other box stands on the shelf spine-out, and its spine carries the
// resume point, written there the moment the game was put away. One model for every device.
import { COUCH, GAMES } from "../../../world";
import { pointIn, type S } from "../state";

/** The boxes on the shelf while `inConsole` is out, top to bottom (couch games only). */
export const shelfOf = (inConsole: string | null): string[] => GAMES.filter((g) => g.shape === "couch" && g.id !== inConsole).map((g) => g.id);

export interface SpineText {
  point: string;
  /** "saved 7:14 pm", "saved Tuesday", or "" for a game with nothing saved. */
  when: string;
}

/** What's written on a game's spine right now. */
export function spineText(s: S, gameId: string): SpineText {
  const point = pointIn(s, gameId);
  const tonight = s.savedTonight[gameId];
  if (tonight) return { point, when: `saved ${tonight}` };
  const inst = COUCH.find((i) => i.gameId === gameId);
  if (inst?.save && inst.status === "suspended") return { point, when: "saved Tuesday" };
  return { point, when: "" };
}
