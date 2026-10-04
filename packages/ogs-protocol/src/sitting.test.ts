import { describe, expect, it } from "vitest";
import { sittingClock, sittingName, sittingStartedAt } from "./sitting";

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;
// Local time, so the clock reads the same in any time zone the tests run in.
const NOW = new Date(2026, 9, 4, 21, 0).getTime();
const at = (h: number, m: number, daysAgo = 0) => new Date(2026, 9, 4 - daysAgo, h, m).getTime();
const id = (start: number) => `catan-${start.toString(36)}`;
const stamp = (patch: Partial<{ instanceId: string; label: string; at: number }> = {}) => ({
  appId: "catan",
  instanceId: "catan-x",
  label: "",
  at: NOW - 5 * MIN,
  ...patch,
});

describe("sittingStartedAt: when a sitting began", () => {
  it("reads the start time from an OGS sitting id (<appId>-<time base 36>)", () => {
    expect(sittingStartedAt(stamp({ instanceId: id(at(19, 42)) }), NOW)).toBe(at(19, 42));
  });
  it("falls back to when it was last played for ids OGS didn't mint", () => {
    expect(sittingStartedAt(stamp({ instanceId: "room-ABCD" }), NOW)).toBe(NOW - 5 * MIN);
    expect(sittingStartedAt(stamp({ instanceId: "catan-" }), NOW)).toBe(NOW - 5 * MIN);
    expect(sittingStartedAt(stamp({ instanceId: "catan-ROOM" }), NOW)).toBe(NOW - 5 * MIN);
  });
  it("ignores an id time after the last play or in the future", () => {
    expect(sittingStartedAt(stamp({ instanceId: id(NOW + H) }), NOW)).toBe(NOW - 5 * MIN);
    expect(sittingStartedAt(stamp({ instanceId: id(NOW - MIN), at: NOW + H }), NOW)).toBe(
      NOW - MIN,
    );
    expect(sittingStartedAt(stamp({ instanceId: id(NOW), at: NOW }), NOW)).toBe(NOW);
    expect(sittingStartedAt(stamp({ instanceId: id(NOW + 1), at: NOW + 1 }), NOW)).toBe(NOW + 1);
  });
});

describe("sittingClock: a 12-hour clock with AM/PM", () => {
  it("reads noon, midnight and the minutes padded", () => {
    expect(sittingClock(at(0, 5))).toBe("12:05 AM");
    expect(sittingClock(at(12, 0))).toBe("12:00 PM");
    expect(sittingClock(at(19, 42))).toBe("7:42 PM");
    expect(sittingClock(at(11, 59))).toBe("11:59 AM");
  });
});

describe("sittingName: what tells one sitting from another (phone and TV alike)", () => {
  it("is the game's resume point when it reported one", () => {
    expect(sittingName(stamp({ label: "Mission 6" }), NOW)).toBe("Mission 6");
  });
  it("else when it started: today's clock time, yesterday, or days ago", () => {
    expect(sittingName(stamp({ instanceId: id(at(19, 42)) }), NOW)).toBe("Started 7:42 PM");
    expect(sittingName(stamp({ instanceId: id(at(20, 0, 1)) }), NOW)).toBe("Started yesterday");
    expect(sittingName(stamp({ instanceId: id(at(20, 0, 3)), at: NOW - 2 * DAY }), NOW)).toBe(
      "Started 3 days ago",
    );
  });
  it("a game's own room code falls back to when it was last played", () => {
    expect(sittingName(stamp({ instanceId: "room-PQWS", at: at(20, 55) }), NOW)).toBe(
      "Started 8:55 PM",
    );
  });
});
