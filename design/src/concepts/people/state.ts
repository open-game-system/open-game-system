// Session state for "People First". One store, shared by every device on the stage.
import { DUELS, type DuelGame } from "../../world";

/** Where the grown-up phone is. */
export type PhoneScreen =
  | { kind: "people"; filter: "all" | "yourMove" }
  | { kind: "people-empty" }
  | { kind: "us" }
  | { kind: "couch" }
  | { kind: "game-night" }
  | { kind: "duels" }
  | { kind: "library" }
  | { kind: "household" }
  | { kind: "duel"; duelId: string; from: "people" | "duels" };

/**
 * Tonight's couch session (the cast). It survives game swaps.
 * phase walks: playing → choosing → saving → cutover → following → playing.
 */
export type SwapPhase = "idle" | "playing" | "choosing" | "saving" | "cutover" | "following";

export interface Couch {
  /** The game the session is showing (null = cast, nothing running: the ambient TV). */
  gameId: string | null;
  phase: SwapPhase;
  /** The game we just left, with the resume point it saved (for "back to …"). */
  left?: { gameId: string; savedAt: string };
  /** Kid devices that have arrived in the current game. */
  arrived: string[];
  /** Ava's iPad: asleep at 9 % means it can't follow until she opens it. */
  avaAsleep: boolean;
  /** Last frosting Juneau picked (Bake Shop), for the kid controller to show off. */
  frosting?: string;
  /** Bumps when a kid taps a big button (for juice). */
  pokes: number;
  /** The grown-up asked Ava's sleeping iPad to chime so someone can find and open it. */
  ringing?: boolean;
}

export interface S {
  phone: PhoneScreen;
  couch: Couch;
  /** Which kid's iPad the "ipad" surface is. */
  ipadOwner: "juneau" | "ava";
  duels: DuelGame[];
  /** Word Duel: rack tiles placed this turn (rack indices, in order). */
  placed: number[];
  /** First run: no household set up yet. */
  firstRun: boolean;
}

export const KIDS = ["juneau", "ava"] as const;

export const base = (over: Partial<S> = {}): S => ({
  phone: { kind: "people", filter: "all" },
  couch: { gameId: "rocket-crew", phase: "playing", arrived: ["juneau", "ava"], avaAsleep: false, pokes: 0 },
  ipadOwner: "juneau",
  duels: DUELS.map((d) => ({ ...d })),
  placed: [],
  firstRun: false,
  ...over,
});

export const couch = (over: Partial<Couch>): Couch => ({ ...base().couch, ...over });

/* ---------- actions (pure) ---------- */

export const go = (phone: PhoneScreen) => (s: S): S => ({ ...s, phone });

export const openSwitcher = (s: S): S => ({ ...s, couch: { ...s.couch, phase: "choosing" } });
export const closeSwitcher = (s: S): S => ({ ...s, couch: { ...s.couch, phase: "playing" } });

/** Pick the next game: the session saves the old one and starts swapping. */
export const pickGame = (gameId: string) => (s: S): S => ({
  ...s,
  couch: {
    ...s.couch,
    phase: "saving",
    left: s.couch.gameId ? { gameId: s.couch.gameId, savedAt: s.couch.gameId === "rocket-crew" ? "Mission 6" : "Day 4" } : undefined,
    gameId,
    arrived: [],
    frosting: undefined,
  },
});

/** The automatic beats after a pick (driven by the host phone's clock, never by a kid). */
export const advance = (s: S): S => {
  const c = s.couch;
  if (c.phase === "saving") return { ...s, couch: { ...c, phase: "cutover" } };
  if (c.phase === "cutover") return { ...s, couch: { ...c, phase: "following" } };
  if (c.phase === "following") {
    const missing = KIDS.filter((k) => !c.arrived.includes(k) && !(k === "ava" && c.avaAsleep));
    const next = missing[0];
    if (next) return { ...s, couch: { ...c, arrived: [...c.arrived, next] } };
    return { ...s, couch: { ...c, phase: "playing" } };
  }
  return s;
};

/** Undo: the session resumes the game we left, exactly where it was. */
export const goBack = (s: S): S => {
  const left = s.couch.left;
  if (!left || !s.couch.gameId) return s;
  return {
    ...s,
    couch: {
      ...s.couch,
      phase: "playing",
      gameId: left.gameId,
      left: { gameId: s.couch.gameId, savedAt: s.couch.gameId === "bake-shop" ? "Day 4" : "Mission 6" },
      arrived: KIDS.filter((k) => !(k === "ava" && s.couch.avaAsleep)),
    },
  };
};

export const wakeAva = (s: S): S => ({
  ...s,
  couch: { ...s.couch, avaAsleep: false, arrived: s.couch.arrived.includes("ava") ? s.couch.arrived : [...s.couch.arrived, "ava"] },
});

export const ringAva = (s: S): S => ({ ...s, couch: { ...s.couch, ringing: true } });

export const frost = (color: string) => (s: S): S => ({ ...s, couch: { ...s.couch, frosting: color, pokes: s.couch.pokes + 1 } });
export const poke = (s: S): S => ({ ...s, couch: { ...s.couch, pokes: s.couch.pokes + 1 } });

/* ---------- Word Duel ---------- */

/** Nana's game: the rack this turn and the word it makes (stubbed placement). */
export const RACK = ["H", "A", "Z", "E", "R", "O", "T"];
export const WORD_SLOTS = 4; // H A Z E, hooking the L of QUILT → HAZEL
export const HAZEL_SCORE = 32;

export const placeTile = (i: number) => (s: S): S =>
  s.placed.includes(i) || s.placed.length >= WORD_SLOTS ? s : { ...s, placed: [...s.placed, i] };

export const recallTiles = (s: S): S => ({ ...s, placed: [] });

export const playMove = (duelId: string) => (s: S): S => ({
  ...s,
  placed: [],
  duels: s.duels.map((d) =>
    d.id === duelId
      ? { ...d, status: "waiting", you: d.you + HAZEL_SCORE, lastMove: `You played HAZEL for ${HAZEL_SCORE}`, lastWord: "HAZEL", updatedAt: "2026-10-03T19:11:00-07:00" }
      : d,
  ),
});
