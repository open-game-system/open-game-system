import type { Instance, SuspendedGame } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { FIXTURE_GAMES, fixtureInstances } from "../session/fixture";
import { buildRows, clock, focusRows, when } from "./layout";

const NOW = new Date(2026, 9, 3, 19, 10).getTime(); // a Saturday, 7:10 pm
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

describe("when", () => {
  it("speaks like a person", () => {
    expect(when(NOW - 30_000, NOW)).toBe("just now");
    expect(when(at(3, 19, 2), NOW)).toBe("at 7:02");
    expect(when(at(3, 9, 5), NOW)).toBe("at 9:05");
    expect(when(at(2, 21), NOW)).toBe("yesterday");
    expect(when(new Date(2026, 8, 29, 10).getTime(), NOW)).toBe("Tuesday");
    expect(when(new Date(2026, 8, 1).getTime(), NOW)).toBe("Sep 1");
  });

  it("formats the clock without am/pm", () => {
    expect(clock(NOW)).toBe("7:10");
    expect(clock(at(3, 0, 5))).toBe("12:05");
    expect(clock(at(3, 12, 30))).toBe("12:30");
  });
});

describe("rows", () => {
  const suspended: SuspendedGame[] = [
    { appId: "rocket-crew", instanceId: "rc-1", label: "Mission 6", at: NOW - 60_000 },
    {
      appId: "bake-shop",
      instanceId: "bs-1",
      label: "Day 4",
      at: new Date(2026, 8, 29, 18).getTime(),
    },
  ];

  it("puts paused games in Continue, game night in Tonight and the rest in Library", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended,
      now: NOW,
    });
    expect(rows.map((r) => [r.id, r.boxes.map((b) => b.appId)])).toEqual([
      ["continue", ["rocket-crew", "bake-shop", "story-nook"]],
      ["tonight", ["hearthisle"]],
      ["library", ["peekaboo-garden", "night-flight"]],
    ]);
  });

  it("tags each box with its status and resume point", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended,
      now: NOW,
    });
    const [cont, tonight, lib] = rows;
    expect(cont?.boxes.map((b) => [b.tag, b.resume])).toEqual([
      ["Paused just now", "Mission 6"],
      ["Paused Tuesday", "Day 4"],
      ["Played yesterday", "Juneau's dragon is ready"],
    ]);
    expect(tonight?.boxes[0]).toMatchObject({ tag: "Tonight at 8:00", resume: "Game night" });
    expect(lib?.boxes[0]).toMatchObject({
      tag: "",
      resume: "Find who is hiding",
      itemId: "game:peekaboo-garden",
    });
  });

  it("a paused game with no resume point shows its tagline, not the pause time twice", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: [],
      suspended: [{ appId: "rocket-crew", instanceId: "rc-1", label: "", at: NOW - 60_000 }],
      now: NOW,
    });
    const rc = rows[0]?.boxes[0];
    const tagline = FIXTURE_GAMES.find((g) => g.appId === "rocket-crew")?.tagline;
    expect(rc).toMatchObject({ appId: "rocket-crew", tag: "Paused just now", resume: tagline });
  });

  it("uses the session's label over an older instance report for the same game", () => {
    const inst: Instance = {
      instanceId: "x",
      appId: "rocket-crew",
      profileId: "p",
      status: "suspended",
      title: "Mission 2",
      detail: "",
      updatedAt: NOW - 1000,
      source: "bridge",
    };
    const rows = buildRows({ games: FIXTURE_GAMES, instances: [inst], suspended, now: NOW });
    expect(rows[0]?.boxes.filter((b) => b.appId === "rocket-crew")).toHaveLength(1);
    expect(rows[0]?.boxes[0]?.resume).toBe("Mission 6");
  });

  it("leaves phone-only games and unknown apps off the TV", () => {
    const games = [
      ...FIXTURE_GAMES,
      {
        ...FIXTURE_GAMES[0]!,
        appId: "word-duel",
        name: "Word Duel",
        tv: "none" as const,
        tvUrl: undefined,
      },
    ];
    const rows = buildRows({
      games,
      instances: [],
      suspended: [{ appId: "gone", instanceId: "g", label: "x", at: NOW }],
      now: NOW,
    });
    const all = rows.flatMap((r) => r.boxes.map((b) => b.appId));
    expect(all).not.toContain("word-duel");
    expect(all).not.toContain("gone");
  });

  it("omits empty rows and exposes the focus grid", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES.slice(0, 2),
      instances: [],
      suspended: [],
      now: NOW,
    });
    expect(rows.map((r) => r.id)).toEqual(["library"]);
    expect(focusRows(rows)).toEqual([
      { id: "library", items: ["game:rocket-crew", "game:bake-shop"] },
    ]);
  });
});
