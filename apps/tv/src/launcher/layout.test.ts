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

  // Owner, 2026-10-04: a sitting is told apart by its resume point, else when it started (the
  // phone's name for it); never the game's tagline, which the spotlight already says.
  it("a paused game with no resume point is named by when it started, as the phone names it", () => {
    const started = at(3, 18, 42);
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: [],
      suspended: [
        {
          appId: "rocket-crew",
          instanceId: `rocket-crew-${started.toString(36)}`,
          label: "",
          at: NOW - 60_000,
        },
      ],
      now: NOW,
    });
    const rc = rows[0]?.boxes[0];
    expect(rc).toMatchObject({
      appId: "rocket-crew",
      tag: "Paused just now",
      resume: "Started 6:42 PM",
    });
    expect(rc?.resume).not.toBe(FIXTURE_GAMES[0]?.tagline);
  });

  it("a game's own room code with no resume point falls back to when it was last played", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: [],
      suspended: [{ appId: "rocket-crew", instanceId: "PQWS", label: "", at: at(3, 18, 5) }],
      now: NOW,
    });
    expect(rows[0]?.boxes[0]?.resume).toBe("Started 6:05 PM");
  });

  it("a visit's title (only the game's name) is not a resume point", () => {
    const visit: Instance = {
      instanceId: "visit-1",
      appId: "bake-shop",
      profileId: "p",
      status: "suspended",
      title: "Bake Shop",
      detail: "",
      updatedAt: at(3, 17, 30),
      source: "visit",
    };
    const rows = buildRows({ games: FIXTURE_GAMES, instances: [visit], suspended: [], now: NOW });
    expect(rows[0]?.boxes[0]).toMatchObject({ tag: "Played at 5:30", resume: "Started 5:30 PM" });
  });

  it("gives each sitting a short card chip: when, without the status word the row already says", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended: [
        ...suspended,
        { appId: "night-flight", instanceId: "nf-1", label: "Level 2", at: at(3, 18, 5) },
      ],
      now: NOW,
    });
    const chips = rows.flatMap((r) => r.boxes.map((b) => [b.appId, b.chip]));
    expect(chips).toEqual([
      ["rocket-crew", "Just now"],
      ["bake-shop", "Tuesday"],
      ["night-flight", "Today 6:05"],
      ["story-nook", "Yesterday"],
      ["hearthisle", "Tonight at 8:00"],
      ["peekaboo-garden", ""],
    ]);
    for (const [, chip] of chips) expect(chip).not.toMatch(/Paused|Played/);
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

describe("when, at the edges", () => {
  it("names every weekday within the last week", () => {
    // NOW is Saturday Oct 3; 2..6 days back are Thursday..Sunday.
    const names = [1, 2, 3, 4, 5, 6].map((back) => when(at(3 - back, 12), NOW));
    expect(names).toEqual(["yesterday", "Thursday", "Wednesday", "Tuesday", "Monday", "Sunday"]);
    expect(when(new Date(2026, 8, 26, 12).getTime(), new Date(2026, 9, 2, 19).getTime())).toBe(
      "Saturday",
    );
    expect(when(new Date(2026, 8, 25, 12).getTime(), new Date(2026, 8, 26, 19).getTime())).toBe(
      "yesterday",
    );
    expect(when(new Date(2026, 8, 25, 12).getTime(), new Date(2026, 8, 27, 19).getTime())).toBe(
      "Friday",
    );
  });

  it("switches to a date exactly a week back", () => {
    expect(when(at(3 - 7, 12), NOW)).toBe("Sep 26");
  });

  it("names every month for older dates", () => {
    const later = new Date(2027, 11, 31, 12).getTime();
    const months = Array.from({ length: 12 }, (_, m) =>
      when(new Date(2026, m, 15).getTime(), later),
    );
    expect(months).toEqual([
      "Jan 15",
      "Feb 15",
      "Mar 15",
      "Apr 15",
      "May 15",
      "Jun 15",
      "Jul 15",
      "Aug 15",
      "Sep 15",
      "Oct 15",
      "Nov 15",
      "Dec 15",
    ]);
  });

  it("is 'just now' only under two minutes", () => {
    expect(when(NOW - 2 * 60 * 1000 + 1, NOW)).toBe("just now");
    expect(when(NOW - 2 * 60 * 1000, NOW)).toBe("at 7:08");
  });

  it("counts calendar days, not hours: 11 pm is yesterday at 12:30 am", () => {
    expect(when(at(2, 23), at(3, 0, 30))).toBe("yesterday");
  });
});

describe("rows, details", () => {
  it("titles the rows for the TV", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended: [{ appId: "rocket-crew", instanceId: "rc-1", label: "M", at: NOW }],
      now: NOW,
    });
    expect(rows.map((r) => r.title)).toEqual(["Continue", "Tonight", "Library"]);
  });

  it("uses the hero art when a game has one, the tile otherwise", () => {
    const withHero = FIXTURE_GAMES[0]!;
    const noHero = { ...FIXTURE_GAMES[1]!, art: { tile: "/art/bake-shop/tv.jpg" } };
    const rows = buildRows({ games: [withHero, noHero], instances: [], suspended: [], now: NOW });
    expect(rows[0]?.boxes.map((b) => [b.cover, b.hero])).toEqual([
      ["/art/rocket-crew/tv.jpg", "/art/rocket-crew/alt.jpg"],
      ["/art/bake-shop/tv.jpg", "/art/bake-shop/tv.jpg"],
    ]);
  });

  it("a paused game on tonight's schedule shows once, in Continue", () => {
    const rows = buildRows({
      games: FIXTURE_GAMES,
      instances: fixtureInstances(NOW),
      suspended: [{ appId: "hearthisle", instanceId: "h", label: "Turn 13", at: NOW }],
      now: NOW,
    });
    expect(rows.map((r) => r.id)).toEqual(["continue", "library"]);
    expect(rows.flatMap((r) => r.boxes).filter((b) => b.appId === "hearthisle")).toHaveLength(1);
  });
});
