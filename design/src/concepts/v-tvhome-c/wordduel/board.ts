// Nana's Word Duel board: words already on it, and where tonight's move goes.
export const SIZE = 11;

export interface Cell {
  r: number;
  c: number;
  ch: string;
  /** Nana's last word, highlighted. */
  last?: boolean;
}

function word(ch: string, r: number, c: number, dir: "across" | "down", last = false): Cell[] {
  return [...ch].map((x, i) => ({ r: dir === "down" ? r + i : r, c: dir === "across" ? c + i : c, ch: x, last }));
}

const placed = [
  ...word("PLANET", 5, 2, "across"),
  ...word("QUILT", 1, 7, "down", true),
  ...word("HAZE", 4, 4, "down"),
  ...word("SKI", 3, 5, "across"),
];

/** Unique cells (crossings share a square). */
export const BOARD: Cell[] = placed.filter((x, i) => placed.findIndex((y) => y.r === x.r && y.c === x.c) === i);

/** Where the hinted move goes, in order: C R A N + the E already on the board. */
export const SLOTS: { r: number; c: number }[] = [
  { r: 7, c: 0 },
  { r: 7, c: 1 },
  { r: 7, c: 2 },
  { r: 7, c: 3 },
];

export const PREMIUM: { r: number; c: number; kind: "3W" | "2W" | "2L" | "3L" }[] = [
  { r: 7, c: 0, kind: "3W" },
  { r: 0, c: 0, kind: "3W" },
  { r: 0, c: 10, kind: "3W" },
  { r: 10, c: 0, kind: "3W" },
  { r: 10, c: 10, kind: "3W" },
  { r: 2, c: 2, kind: "2W" },
  { r: 8, c: 8, kind: "2W" },
  { r: 2, c: 8, kind: "2W" },
  { r: 8, c: 2, kind: "2W" },
  { r: 9, c: 5, kind: "3L" },
  { r: 1, c: 3, kind: "2L" },
  { r: 6, c: 9, kind: "2L" },
];

export const POINTS: Record<string, number> = { C: 3, R: 1, A: 1, N: 1, S: 1, D: 2, O: 1, E: 1, Q: 10, U: 1, I: 1, L: 1, T: 1, P: 3, H: 4, Z: 10, K: 5 };
