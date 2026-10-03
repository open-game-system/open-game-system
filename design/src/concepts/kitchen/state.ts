// Porchlight session state: one household, tonight's couch session, and the phone's place in it.
import { DUELS, type DuelGame } from "../../world";

export type Kid = "juneau" | "ava";

/** What the living room TV is doing tonight. The couch session survives every swap. */
export type Tonight =
  | { kind: "idle" }
  | { kind: "playing"; gameId: string; after?: { from: string; undone: boolean } }
  | { kind: "switching"; from: string; to: string; step: SwitchStep; undo: boolean };

export type SwitchStep = "saving" | "cutover" | "following";

export type PhoneScreen = "home" | "first-run" | "family" | "game" | "duels" | "duel" | "lock";
export type Sheet = "switcher" | "new-duel" | null;

export interface S {
  phone: PhoneScreen;
  sheet: Sheet;
  clock: string;
  tonight: Tonight;
  /** Which kid's iPad this session's iPad surface is. */
  ipadOf: Kid;
  /** Ava's iPad went to sleep at 9% and missed the swap. */
  avaAsleep: boolean;
  /** Ava's iPad woke up and caught up. */
  avaCaughtUp: boolean;
  duels: DuelGame[];
  openDuel: string | null;
  placed: string[];
  sent: boolean;
}

export const base = (over: Partial<S> = {}): S => ({
  phone: "home",
  sheet: null,
  clock: "7:10",
  tonight: { kind: "playing", gameId: "rocket-crew" },
  ipadOf: "juneau",
  avaAsleep: false,
  avaCaughtUp: false,
  duels: DUELS,
  openDuel: null,
  placed: [],
  sent: false,
  ...over,
});

/** Where the swap goes next. Each step is a few hundred ms of real work in the product. */
export const nextStep = (step: SwitchStep): SwitchStep | null =>
  step === "saving" ? "cutover" : step === "cutover" ? "following" : null;

export const startSwitch = (s: S, to: string, undo = false): S => {
  const from = currentGame(s);
  if (!from || from === to) return { ...s, sheet: null };
  return { ...s, sheet: null, phone: "game", tonight: { kind: "switching", from, to, step: "saving", undo } };
};

export const advance = (s: S): S => {
  const t = s.tonight;
  if (t.kind !== "switching") return s;
  const n = nextStep(t.step);
  if (n) return { ...s, tonight: { ...t, step: n } };
  return { ...s, tonight: { kind: "playing", gameId: t.to, after: { from: t.from, undone: t.undo } } };
};

export const currentGame = (s: S): string | null =>
  s.tonight.kind === "playing" ? s.tonight.gameId : s.tonight.kind === "switching" ? s.tonight.to : null;

/** The Word Duel move this prototype plays: LOFT down from the L of Nana's QUILT. */
export const MOVE = { word: "LOFT", score: 14, letters: ["O", "F", "T"] };

export const playMove = (s: S): S => ({
  ...s,
  sent: true,
  duels: s.duels.map((d): DuelGame =>
    d.id === s.openDuel
      ? { ...d, status: "waiting", you: d.you + MOVE.score, lastMove: `You played ${MOVE.word} for ${MOVE.score}`, lastWord: MOVE.word, updatedAt: "2026-10-03T19:12:00-07:00" }
      : d,
  ),
});
