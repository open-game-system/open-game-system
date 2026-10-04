import type { CastingFriend, Friend, Presence } from "@open-game-system/ogs-protocol";
import { castCardLines, joinCards, presenceLabel, qrRuns, subtitleOf } from "../friends-view";

const mom = { id: "p_mom", handle: "mom.m", name: "Mom", sticker: "owl" };
const rocket = { appId: "rocket-crew", name: "Rocket Crew" };
const f = (presence: Presence): Friend => ({ ...mom, presence, since: 1 });
const card = (extra: Partial<CastingFriend> = {}): CastingFriend => ({
  sessionId: "s1",
  tvName: "Living room TV",
  host: mom,
  game: null,
  joined: false,
  ...extra,
});

describe("presence in words", () => {
  it.each<[Presence, string | null]>([
    [
      { kind: "casting", sessionId: "s", tvName: "Living room TV", game: null },
      "Casting on Living room TV",
    ],
    [
      { kind: "casting", sessionId: "s", tvName: "Den", game: rocket },
      "Casting Rocket Crew on Den",
    ],
    [{ kind: "playing", sessionId: "s", tvName: "Den", game: rocket }, "Playing Rocket Crew"],
    [{ kind: "online" }, "Online"],
    [{ kind: "offline", lastSeenAt: 5 }, null],
  ])("%o → %s", (p, label) => {
    expect(presenceLabel(p)).toBe(label);
  });

  it("the row under a name is the @id, then presence when there is one", () => {
    expect(subtitleOf(f({ kind: "online" }))).toBe("@mom.m · Online");
    expect(subtitleOf(f({ kind: "offline", lastSeenAt: null }))).toBe("@mom.m");
  });
});

describe("Join cards", () => {
  it("hides the cast this device is already on", () => {
    const a = card();
    const b = card({ sessionId: "s2", tvName: "Den" });
    expect(joinCards([a, b], "s1")).toEqual([b]);
    expect(joinCards([a, b], null)).toEqual([a, b]);
  });

  it("says who casts where, and what plays", () => {
    expect(castCardLines(card())).toEqual({
      title: "Mom is casting on Living room TV",
      detail: "Mom's games",
    });
    expect(castCardLines(card({ game: rocket }))).toEqual({
      title: "Mom is casting on Living room TV",
      detail: "Playing Rocket Crew",
    });
  });
});

describe("qrRuns: the QR as runs of dark modules per row", () => {
  it("is square, with finder patterns in three corners", () => {
    const { size, rows } = qrRuns("https://opengame.org/add/abc");
    expect(rows).toHaveLength(size);
    expect(size).toBeGreaterThanOrEqual(21);
    // The top-left finder: a 7-module dark run on its first row.
    expect(rows[0][0]).toEqual({ x: 0, y: 0, w: 7 });
    expect(rows[0].at(-1)).toEqual({ x: size - 7, y: 0, w: 7 });
    expect(rows[size - 1][0]).toEqual({ x: 0, y: size - 1, w: 7 });
  });

  it("runs never overlap and stay inside the row", () => {
    const { size, rows } = qrRuns("KITE-42");
    for (const row of rows) {
      let end = 0;
      for (const r of row) {
        expect(r.x).toBeGreaterThanOrEqual(end);
        expect(r.w).toBeGreaterThan(0);
        end = r.x + r.w;
      }
      expect(end).toBeLessThanOrEqual(size);
    }
  });

  it("different text, different code", () => {
    expect(qrRuns("a").rows).not.toEqual(qrRuns("b").rows);
  });
});
