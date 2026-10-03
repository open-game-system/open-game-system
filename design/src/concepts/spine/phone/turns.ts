// The turn inbox: every game's "your move", counted in one place for the spine.
import { HEARTHISLE } from "../../../world";
import type { S } from "../state";

export const yourTurnCount = (s: S) =>
  s.duel.games.filter((g) => g.status === "yourTurn").length + (HEARTHISLE.yourTurn ? 1 : 0);
