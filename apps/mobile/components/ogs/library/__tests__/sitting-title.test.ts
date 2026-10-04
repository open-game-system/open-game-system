import type { Sitting } from "../../../../services/sittings";
import { sittingTitle, sittingTitles, startedAt } from "../sitting-title";

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;
// Local time, so the clock reads the same in any time zone the tests run in.
const NOW = new Date(2026, 9, 4, 21, 0).getTime();
const at = (h: number, m: number, daysAgo = 0) => new Date(2026, 9, 4 - daysAgo, h, m).getTime();

const sitting = (patch: Partial<Sitting> = {}): Sitting => ({
  instanceId: "catan-x",
  label: "",
  at: NOW - 5 * MIN,
  resumeUrl: undefined,
  live: false,
  ...patch,
});
const id = (start: number) => `catan-${start.toString(36)}`;

describe("startedAt: when a sitting began", () => {
  it("reads the start time from an OGS sitting id (<appId>-<time base 36>)", () => {
    expect(startedAt(sitting({ instanceId: id(at(19, 42)) }), "catan", NOW)).toBe(at(19, 42));
  });
  it("falls back to when it was last played for ids OGS didn't mint", () => {
    expect(startedAt(sitting({ instanceId: "room-ABCD" }), "catan", NOW)).toBe(NOW - 5 * MIN);
    expect(startedAt(sitting({ instanceId: "catan-" }), "catan", NOW)).toBe(NOW - 5 * MIN);
  });
  it("ignores an id time after the last play or in the future", () => {
    expect(startedAt(sitting({ instanceId: id(NOW + H) }), "catan", NOW)).toBe(NOW - 5 * MIN);
  });
});

describe("sittingTitle: a sitting row's headline and its second line", () => {
  it("the headline is the resume point when the game reported one", () => {
    expect(sittingTitle(sitting({ label: "Mission 6" }), "catan", NOW)).toEqual({
      headline: "Mission 6",
      detail: "Played 5 min ago",
    });
  });

  it("without a resume point: started today reads its clock time", () => {
    const t = sittingTitle(sitting({ instanceId: id(at(19, 42)) }), "catan", NOW);
    expect(t.headline).toMatch(/^Started 7:42\s?PM$/);
    expect(t.detail).toBe("Played 5 min ago");
  });

  it("started yesterday, or days ago", () => {
    expect(sittingTitle(sitting({ instanceId: id(at(20, 0, 1)) }), "catan", NOW).headline).toBe(
      "Started yesterday",
    );
    expect(
      sittingTitle(sitting({ instanceId: id(at(20, 0, 3)), at: NOW - 2 * DAY }), "catan", NOW)
        .headline,
    ).toBe("Started 3 days ago");
  });

  it("never repeats the section heading", () => {
    const t = sittingTitle(sitting(), "catan", NOW);
    expect(t.headline).not.toMatch(/in progress/i);
    expect(t.detail).not.toMatch(/in progress/i);
  });

  it("a live sitting says it's on the TV now", () => {
    expect(sittingTitle(sitting({ live: true, label: "Level 3" }), "catan", NOW)).toEqual({
      headline: "Level 3",
      detail: "On the TV now",
    });
  });

  it("just played reads 'Played just now'", () => {
    expect(sittingTitle(sitting({ at: NOW - 10_000 }), "catan", NOW).detail).toBe(
      "Played just now",
    );
  });
});

describe("sittingTitles: a game page's cards never read the same", () => {
  it("keeps distinct headlines as they are", () => {
    const list = [
      sitting({ instanceId: "a", label: "Mission 6" }),
      sitting({ instanceId: "b", label: "Mission 2" }),
    ];
    expect(sittingTitles(list, "catan", NOW).map((t) => t.headline)).toEqual([
      "Mission 6",
      "Mission 2",
    ]);
  });

  it("two started the same minute are numbered by start order, the time moving to the second line", () => {
    const older = sitting({ instanceId: id(at(11, 3)), at: NOW - 10 * MIN });
    const newer = sitting({ instanceId: id(at(11, 3) + 20_000), at: NOW - MIN });
    const titles = sittingTitles([newer, older], "catan", NOW);
    expect(titles.map((t) => t.headline)).toEqual(["Game 2", "Game 1"]);
    expect(titles[0].detail).toMatch(/^Started 11:03\s?AM · played 1 min ago$/);
    expect(titles[1].detail).toMatch(/^Started 11:03\s?AM · played 10 min ago$/);
  });

  it("a live one keeps 'On the TV now' on its second line", () => {
    const a = sitting({ instanceId: id(at(11, 3)), live: true });
    const b = sitting({ instanceId: id(at(11, 3) + 1000) });
    expect(sittingTitles([a, b], "catan", NOW)[0].detail).toMatch(
      /^Started 11:03\s?AM · On the TV now$/,
    );
  });
});
