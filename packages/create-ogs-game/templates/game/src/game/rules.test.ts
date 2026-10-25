import { describe, expect, it } from "vitest";
import { COLORS, ROUNDS, makeRound, scorePick, winners } from "./rules";

describe("makeRound", () => {
  it("is the same round for the same seed and index", () => {
    expect(makeRound(42, 0)).toEqual(makeRound(42, 0));
  });

  it("differs between rounds of one game", () => {
    expect(makeRound(42, 0)).not.toEqual(makeRound(42, 1));
  });

  it("has exactly one color with the most shapes, and that is the answer", () => {
    for (let seed = 1; seed < 200; seed++) {
      for (let i = 0; i < ROUNDS; i++) {
        const round = makeRound(seed, i);
        const top = Math.max(...COLORS.map((c) => round.counts[c]));
        const leaders = COLORS.filter((c) => round.counts[c] === top);
        expect(leaders).toEqual([round.answer]);
      }
    }
  });

  it("counts every shape it draws", () => {
    const round = makeRound(7, 3);
    for (const color of COLORS) {
      expect(round.shapes.filter((s) => s.color === color)).toHaveLength(round.counts[color]);
    }
  });

  it("gets busier and closer each round", () => {
    const first = makeRound(9, 0);
    const last = makeRound(9, ROUNDS - 1);
    expect(last.shapes.length).toBeGreaterThan(first.shapes.length);
  });

  it("keeps every shape on screen (0..1 coordinates)", () => {
    for (const s of makeRound(3, 4).shapes) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("scorePick", () => {
  const round = makeRound(5, 0);
  it("gives a point for the answer", () => {
    expect(scorePick(round, round.answer)).toBe(1);
  });
  it("gives nothing for another color or no pick", () => {
    const wrong = COLORS.find((c) => c !== round.answer);
    expect(scorePick(round, wrong ?? null)).toBe(0);
    expect(scorePick(round, null)).toBe(0);
  });
});

describe("winners", () => {
  it("names everyone tied on the top score", () => {
    const players = [
      { seat: "p1", name: "Ana", score: 3 },
      { seat: "p2", name: "Bo", score: 5 },
      { seat: "p3", name: "Cy", score: 5 },
    ];
    expect(winners(players)).toEqual(["Bo", "Cy"]);
  });
  it("is nobody without players", () => {
    expect(winners([])).toEqual([]);
  });
});
