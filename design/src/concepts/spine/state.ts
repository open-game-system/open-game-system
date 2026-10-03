// Session state for the Spine concept. One store, every device reads it.
import { DUELS, type DuelGame } from "../../world";

/** What the grown-up phone shows above the spine. */
export type PhoneView = "home" | "game" | "deck" | "seats" | "duel-list" | "duel-board" | "duel-new";

/** A game swap inside one cast session, step by step. */
export type SwapPhase = "none" | "saving" | "cutover" | "following" | "done";

export interface DuelState {
  games: DuelGame[];
  openId?: string;
  /** Tiles placed from the rack this turn (stubbed: each tap places the next letter). */
  placed: number;
  played: boolean;
}

export interface S {
  /** First-time install: no household yet, nothing cast. */
  firstRun: boolean;
  phone: PhoneView;
  /** A couch session is cast to the living room TV. */
  cast: boolean;
  /** The game on the living room TV (the couch session's current game). */
  current: string;
  /** Previous game, for "back to …" undo after a swap. */
  previous?: string;
  /** The cover opened from the deck (its seats sheet). */
  pick?: string;
  /** The game being swapped to, while the swap runs. */
  target?: string;
  swap: SwapPhase;
  /** The TV is held between moments (grown-up went to home); the game's art goes ambient. */
  tvHeld: boolean;
  /** Which kid iPad this shot shows. The stage always shows Juneau's. */
  ipadOwner: "juneau" | "ava";
  avaAsleep: boolean;
  /** Ava's seat moved onto Juneau's iPad (split in two) while hers sleeps. */
  avaOnJuneau: boolean;
  /** Undo offer after a swap, shown in the spine's ledge. */
  undo: boolean;
  /** Rocket Crew was swapped back to (undo used). */
  undone: boolean;
  duel: DuelState;
}

export const base = (): S => ({
  firstRun: false,
  cast: true,
  phone: "game",
  current: "rocket-crew",
  swap: "none",
  tvHeld: false,
  ipadOwner: "juneau",
  avaAsleep: false,
  avaOnJuneau: false,
  undo: false,
  undone: false,
  duel: { games: DUELS, placed: 0, played: false },
});

export const with_ = (patch: Partial<S>): S => ({ ...base(), ...patch });

/** The word we stub-play on Nana's board: T is already there (QUILT's last letter). */
export const PLAY = { word: "TIDE", tiles: ["I", "D", "E"], score: 14 };
export const RACK = ["E", "R", "I", "N", "D", "A", "S"];

/** After a move: the game moves from "your turn" to "waiting", newest first. */
export function afterMove(games: DuelGame[], id: string): DuelGame[] {
  const moved = games.find((g) => g.id === id);
  if (!moved) return games;
  const next: DuelGame = {
    ...moved,
    status: "waiting",
    you: moved.you + PLAY.score,
    lastMove: `You played ${PLAY.word} for ${PLAY.score}`,
    lastWord: PLAY.word,
    updatedAt: "2026-10-03T19:12:00-07:00",
  };
  return [next, ...games.filter((g) => g.id !== id)];
}
