import { describe, expect, it } from "vitest";
import { type Instance, playingView } from "./instance";

const NOW = Date.parse("2026-10-03T19:10:00-07:00");
const H = 60 * 60 * 1000;
const D = 24 * H;
const base = (over: Partial<Instance>): Instance => ({
  instanceId: "x",
  appId: "rocket-crew",
  householdId: "hh",
  status: "active",
  title: "Mission 6",
  detail: "",
  updatedAt: NOW - H,
  source: "bridge",
  ...over,
});
const ttl = () => 7 * D;

describe("playingView", () => {
  it("pins the live game and orders sections by what needs you", () => {
    const view = playingView(
      [
        base({ instanceId: "bake", appId: "bake-shop", status: "suspended", title: "Day 4" }),
        base({
          instanceId: "duel-nana",
          appId: "word-duel",
          status: "waiting",
          yourTurn: true,
          title: "Nana played QUILT",
        }),
        base({ instanceId: "rc", appId: "rocket-crew", status: "active" }),
        base({
          instanceId: "night",
          appId: "hearthisle",
          status: "suspended",
          startsAt: NOW + 2 * H,
        }),
        base({ instanceId: "duel-tunde", appId: "word-duel", status: "waiting", yourTurn: false }),
      ],
      { now: NOW, liveInstanceIds: ["rc"], ttlFor: ttl },
    );
    expect(view.live?.instanceId).toBe("rc");
    expect(view.sections.map((s) => s.kind)).toEqual(["yourTurn", "tonight", "paused", "waiting"]);
    expect(view.badge).toBe(1);
  });

  it("hides expired instances and shows completed ones for a day only", () => {
    const view = playingView(
      [
        base({ instanceId: "old", status: "suspended", updatedAt: NOW - 8 * D }),
        base({ instanceId: "done-today", status: "completed", updatedAt: NOW - 2 * H }),
        base({ instanceId: "done-long-ago", status: "completed", updatedAt: NOW - 2 * D }),
        base({ instanceId: "gone", status: "expired" }),
      ],
      { now: NOW, liveInstanceIds: [], ttlFor: ttl },
    );
    const ids = view.sections.flatMap((s) => s.items.map((i) => i.instanceId));
    expect(ids).toEqual(["done-today"]);
    expect(view.sections[0]?.kind).toBe("finished");
  });

  // Owner, 2026-10-04: "you might have say multiple games of catan going": every sitting is its
  // own row (visits are per sitting now, one id each), newest first.
  it("keeps every sitting of an unreported (Tier 0) game as its own entry, newest first", () => {
    const view = playingView(
      [
        base({
          instanceId: "v1",
          appId: "peekaboo-garden",
          source: "visit",
          status: "suspended",
          updatedAt: NOW - 3 * H,
        }),
        base({
          instanceId: "v2",
          appId: "peekaboo-garden",
          source: "visit",
          status: "suspended",
          updatedAt: NOW - 1 * H,
        }),
        base({
          instanceId: "v3",
          appId: "peekaboo-garden",
          source: "visit",
          status: "suspended",
          updatedAt: NOW - 5 * H,
        }),
      ],
      { now: NOW, liveInstanceIds: [], ttlFor: ttl },
    );
    const ids = view.sections.flatMap((s) => s.items.map((i) => i.instanceId));
    expect(ids).toEqual(["v2", "v1", "v3"]);
  });

  it("is empty with no badge when nothing is in flight", () => {
    const view = playingView([], { now: NOW, liveInstanceIds: [], ttlFor: ttl });
    expect(view).toEqual({ live: null, sections: [], badge: 0 });
  });
});
