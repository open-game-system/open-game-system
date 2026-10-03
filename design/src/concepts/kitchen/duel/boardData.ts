// Nana's board (design stand-in): 11×11, the words already down, premium squares, the move slots.
export const SIZE = 11;
type Cell = { r: number; c: number; ch: string; by: "you" | "them"; last?: boolean };

const word = (w: string, r: number, c: number, dir: "across" | "down", by: "you" | "them", last = false): Cell[] =>
  w.split("").map((ch, i) => ({ r: dir === "down" ? r + i : r, c: dir === "across" ? c + i : c, ch, by, last }));

export const TILES: Cell[] = dedupe([
  ...word("SLAB", 0, 5, "down", "you"),
  ...word("HARBOR", 3, 2, "across", "them"),
  ...word("OUST", 3, 6, "down", "you"),
  ...word("QUILT", 6, 2, "across", "them", true),
]);

/** Where this move goes: down from the L of QUILT. */
export const SLOTS: { r: number; c: number }[] = [
  { r: 7, c: 5 },
  { r: 8, c: 5 },
  { r: 9, c: 5 },
];

export const PREMIUM: Record<string, "tw" | "dw" | "tl" | "dl" | "star"> = {
  "0,0": "tw", "0,10": "tw", "10,0": "tw", "10,10": "tw",
  "5,5": "star", "9,5": "dw", "1,1": "dw", "1,9": "dw", "9,1": "dw", "9,9": "dw",
  "2,4": "tl", "2,6": "tl", "8,4": "dl", "8,8": "tl", "4,8": "dl", "4,2": "dl",
};

export const RACK = ["O", "F", "T", "E", "A", "N", "S"];
export const POINTS: Record<string, number> = { O: 1, F: 4, T: 1, E: 1, A: 1, N: 1, S: 1, L: 1 };

function dedupe(cells: Cell[]): Cell[] {
  const m = new Map<string, Cell>();
  for (const c of cells) {
    const k = `${c.r},${c.c}`;
    const prev = m.get(k);
    m.set(k, prev ? { ...prev, last: prev.last || c.last } : c);
  }
  return [...m.values()];
}
