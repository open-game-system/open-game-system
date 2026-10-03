// Nana's game: a believable little board. Tiles already down, the premium squares, and our rack.
export interface Tile { r: number; c: number; ch: string; mine?: boolean; last?: boolean }

export const SIZE = 11;
export const VALUE: Record<string, number> = { Q: 10, U: 1, I: 1, L: 1, T: 1, A: 1, R: 1, C: 3, O: 1, N: 1, E: 1, S: 1, D: 2, F: 4, G: 2 };

export const DOWN: Tile[] = [
  { r: 4, c: 2, ch: "A", mine: true }, { r: 5, c: 2, ch: "Q", last: true }, { r: 6, c: 2, ch: "U", mine: true }, { r: 7, c: 2, ch: "A", mine: true },
  { r: 7, c: 3, ch: "R", mine: true }, { r: 7, c: 4, ch: "C", mine: true },
  { r: 5, c: 3, ch: "U", last: true }, { r: 5, c: 4, ch: "I", last: true }, { r: 5, c: 5, ch: "L", last: true }, { r: 5, c: 6, ch: "T", last: true },
  { r: 3, c: 5, ch: "O" }, { r: 4, c: 5, ch: "I" },
];

/** Where our word goes, one square per placed tile (TONE, down from QUILT's T). */
export const SLOTS: { r: number; c: number }[] = [{ r: 6, c: 6 }, { r: 7, c: 6 }, { r: 8, c: 6 }];
export const RACK = ["O", "N", "E", "R", "S", "D", "I"];
export const WORD = "TONE";
export const SCORE = 12;

export const PREMIUM: Record<string, "tw" | "dw" | "tl" | "dl" | "star"> = {
  "0,0": "tw", "0,10": "tw", "10,0": "tw", "10,10": "tw", "8,6": "tw", "2,2": "dw", "2,8": "dw", "8,2": "dw", "8,8": "dw",
  "1,5": "tl", "5,1": "tl", "5,9": "tl", "9,5": "tl", "3,3": "dl", "3,7": "dl", "7,7": "dl", "7,3": "dl", "5,5": "star",
};
