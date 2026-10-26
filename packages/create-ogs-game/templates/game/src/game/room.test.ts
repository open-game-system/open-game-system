import { describe, expect, it } from "vitest";
import { ROUNDS, TIMING } from "./rules";
import { advance, due, join, newRoom, pick, start } from "./room";

const T0 = 1_000_000;
const room = () => newRoom({ roomCode: "ABCD", tvId: "tv", seed: 11 });

function withPlayers(...names: string[]) {
  let s = room();
  names.forEach((name, i) => {
    s = join(s, { callerId: `c${i + 1}`, name, ogsId: null });
  });
  return s;
}

describe("join", () => {
  it("seats the first phone as p1 and the next as p2", () => {
    const s = withPlayers("Ana", "Bo");
    expect(s.seats.map((x) => [x.seat, x.name])).toEqual([
      ["p1", "Ana"],
      ["p2", "Bo"],
    ]);
  });

  it("keeps a phone's seat when it joins again (a refresh)", () => {
    const s = join(withPlayers("Ana"), { callerId: "c1", name: "Other", ogsId: null });
    expect(s.seats).toHaveLength(1);
    expect(s.seats[0]?.name).toBe("Ana");
  });

  it("names a blank seat Player N and tidies typed names", () => {
    let s = join(room(), { callerId: "a", name: "   ", ogsId: null });
    s = join(s, { callerId: "b", name: "  Bo   Peep  ", ogsId: null });
    expect(s.seats.map((x) => x.name)).toEqual(["Player 1", "Bo Peep"]);
  });

  it("never seats the TV", () => {
    expect(join(room(), { callerId: "tv", name: "TV", ogsId: null }).seats).toEqual([]);
  });

  it("stops at eight players", () => {
    let s = room();
    for (let i = 0; i < 10; i++) s = join(s, { callerId: `c${i}`, name: `P${i}`, ogsId: null });
    expect(s.seats).toHaveLength(8);
  });
});

describe("start", () => {
  it("only the host (first seat) can start, and only with a player", () => {
    const s = withPlayers("Ana", "Bo");
    expect(start(s, "c2", T0).phase).toBe("lobby");
    expect(start(room(), "tv", T0).phase).toBe("lobby");
    const started = start(s, "c1", T0);
    expect(started.phase).toBe("show");
    expect(started.round).toBe(0);
    expect(started.endsAt).toBe(T0 + TIMING.showMs);
    expect(started.current?.shapes.length).toBeGreaterThan(0);
  });

  it("does nothing mid-game", () => {
    const s = start(withPlayers("Ana"), "c1", T0);
    expect(start(s, "c1", T0 + 5)).toBe(s);
  });
});

describe("a round", () => {
  it("goes show → answer → reveal, scoring the right pick", () => {
    let s = start(withPlayers("Ana", "Bo"), "c1", T0);
    const answer = s.current?.answer ?? "coral";
    const wrong = answer === "coral" ? "sky" : "coral";
    s = advance(s, T0 + TIMING.showMs);
    expect(s.phase).toBe("answer");
    expect(s.endsAt).toBe(T0 + TIMING.showMs + TIMING.answerMs);
    s = pick(s, "c1", answer, T0 + 5000);
    expect(s.phase).toBe("answer");
    s = pick(s, "c2", wrong, T0 + 5100);
    // Everyone picked: the reveal comes at once.
    expect(s.phase).toBe("reveal");
    expect(s.seats.map((x) => [x.score, x.correct])).toEqual([
      [1, true],
      [0, false],
    ]);
  });

  it("ignores a second pick, a pick outside the answer phase and the TV's pick", () => {
    let s = start(withPlayers("Ana", "Bo"), "c1", T0);
    expect(pick(s, "c1", "sky", T0)).toBe(s);
    s = advance(s, T0 + TIMING.showMs);
    s = pick(s, "c1", "sky", T0 + 1);
    expect(pick(s, "c1", "lime", T0 + 2)).toBe(s);
    expect(pick(s, "tv", "lime", T0 + 2)).toBe(s);
  });

  it("reveals when the answer time runs out, even if someone never picked", () => {
    let s = start(withPlayers("Ana"), "c1", T0);
    s = advance(s, T0 + TIMING.showMs);
    s = advance(s, T0 + TIMING.showMs + TIMING.answerMs);
    expect(s.phase).toBe("reveal");
    expect(s.seats[0]?.correct).toBe(false);
  });

  it("plays every round, then ends", () => {
    let s = start(withPlayers("Ana"), "c1", T0);
    let now = T0;
    for (let r = 0; r < ROUNDS; r++) {
      expect(s.round).toBe(r);
      for (const phase of ["show", "answer", "reveal"]) {
        expect(s.phase).toBe(phase);
        now = s.endsAt ?? now;
        s = advance(s, now);
      }
    }
    expect(s.phase).toBe("over");
    expect(s.endsAt).toBeNull();
  });

  it("a new game from the end starts at round 0 with scores reset and a new seed", () => {
    let s = start(withPlayers("Ana"), "c1", T0);
    s = { ...s, phase: "over", seats: s.seats.map((x) => ({ ...x, score: 4 })), endsAt: null };
    const again = start(s, "c1", T0 + 99);
    expect(again.phase).toBe("show");
    expect(again.seats[0]?.score).toBe(0);
    expect(again.seed).not.toBe(s.seed);
  });
});

describe("due", () => {
  it("is true once the phase's deadline has passed", () => {
    const s = start(withPlayers("Ana"), "c1", T0);
    expect(due(s, T0 + TIMING.showMs - 1)).toBe(false);
    expect(due(s, T0 + TIMING.showMs)).toBe(true);
    expect(due(room(), T0)).toBe(false);
  });
});
