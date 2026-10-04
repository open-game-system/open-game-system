import { describe, expect, it } from "vitest";
import { type Instance, InstanceReportSchema, InstanceSchema, playingView } from "./instance";

const instance = () => ({
  instanceId: "rocket-crew-abc",
  appId: "rocket-crew",
  householdId: "hh-mumm",
  status: "active",
  updatedAt: 1_000,
  source: "bridge",
});
const omit = (o: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

describe("instance schema", () => {
  it("accepts a minimal instance with empty title and detail", () => {
    expect(InstanceSchema.parse(instance())).toEqual({ ...instance(), title: "", detail: "" });
  });

  it("keeps every optional field it is given", () => {
    const full = {
      ...instance(),
      title: "Mission 6",
      detail: "Fixing the engine",
      yourTurn: true,
      startsAt: 2_000,
      resumeUrl: "https://rocket-crew.example/i/abc",
    };
    expect(InstanceSchema.parse(full)).toEqual(full);
  });

  it.each([
    "instanceId",
    "appId",
    "householdId",
    "status",
    "updatedAt",
    "source",
  ])("an instance without %s is rejected", (key) => {
    expect(InstanceSchema.safeParse(omit(instance(), key)).success).toBe(false);
  });

  it.each(["instanceId", "appId", "householdId"])("an empty %s is rejected", (key) => {
    expect(InstanceSchema.safeParse({ ...instance(), [key]: "" }).success).toBe(false);
  });

  it.each([
    "lobby",
    "active",
    "suspended",
    "waiting",
    "completed",
    "expired",
  ])("accepts the status %s", (status) => {
    expect(InstanceSchema.parse({ ...instance(), status }).status).toBe(status);
  });

  it("rejects an unknown status", () => {
    expect(InstanceSchema.safeParse({ ...instance(), status: "paused" }).success).toBe(false);
  });

  it.each(["bridge", "server", "visit"])("accepts the source %s", (source) => {
    expect(InstanceSchema.parse({ ...instance(), source }).source).toBe(source);
  });

  it("rejects an unknown source", () => {
    expect(InstanceSchema.safeParse({ ...instance(), source: "guess" }).success).toBe(false);
  });

  it("rejects a resume URL that isn't a URL", () => {
    expect(InstanceSchema.safeParse({ ...instance(), resumeUrl: "later" }).success).toBe(false);
  });
});

describe("instance report (what a game sends)", () => {
  const report = {
    instanceId: "rocket-crew-abc",
    appId: "rocket-crew",
    status: "waiting",
    title: "Your move",
    detail: "Nana played QUILT",
    yourTurn: true,
    startsAt: 2_000,
    resumeUrl: "https://word-duel.example/i/abc",
  };

  it("keeps everything a game may report", () => {
    expect(InstanceReportSchema.parse(report)).toEqual(report);
  });

  it("needs no household, time or source: those come from the token and receiver", () => {
    const r = { instanceId: "i", appId: "a", status: "active" };
    expect(InstanceReportSchema.parse(r)).toEqual({ ...r, title: "", detail: "" });
  });

  it("drops a household, time or source the game tries to set", () => {
    const parsed = InstanceReportSchema.parse({
      ...report,
      householdId: "someone-else",
      updatedAt: 5,
      source: "server",
    });
    expect(parsed).toEqual(report);
  });

  it.each(["instanceId", "appId", "status"])("a report without %s is rejected", (key) => {
    expect(InstanceReportSchema.safeParse(omit(report, key)).success).toBe(false);
  });
});

const NOW = 100 * 24 * 60 * 60 * 1000;
const H = 60 * 60 * 1000;
const D = 24 * H;
const inst = (over: Partial<Instance>): Instance => ({
  instanceId: "x",
  appId: "rocket-crew",
  householdId: "hh",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: NOW - H,
  source: "bridge",
  ...over,
});
const week = () => 7 * D;
const view = (
  instances: Instance[],
  liveInstanceIds: string[] = [],
  ttlFor: (appId: string) => number = week,
) => playingView(instances, { now: NOW, liveInstanceIds, ttlFor });
const kinds = (v: ReturnType<typeof playingView>) =>
  Object.fromEntries(v.sections.flatMap((s) => s.items.map((i) => [i.instanceId, s.kind])));

describe("playing tab", () => {
  it.each([
    "lobby",
    "active",
    "suspended",
  ] as const)("an unscheduled %s game that isn't on a screen is paused", (status) => {
    expect(kinds(view([inst({ instanceId: "a", status })]))).toEqual({ a: "paused" });
  });

  it("an expired instance is never shown, even if just updated", () => {
    expect(view([inst({ status: "expired", updatedAt: NOW })]).sections).toEqual([]);
  });

  it("a waiting game is yours only when it's your turn", () => {
    const v = view([
      inst({ instanceId: "mine", status: "waiting", yourTurn: true }),
      inst({ instanceId: "theirs", status: "waiting", yourTurn: false }),
      inst({ instanceId: "unknown", status: "waiting" }),
    ]);
    expect(kinds(v)).toEqual({ mine: "yourTurn", theirs: "waiting", unknown: "waiting" });
    expect(v.badge).toBe(1);
  });

  it("the badge counts every your-turn game", () => {
    const v = view([
      inst({ instanceId: "a", status: "waiting", yourTurn: true }),
      inst({ instanceId: "b", status: "waiting", yourTurn: true }),
    ]);
    expect(v.badge).toBe(2);
  });

  it("a sitting scheduled from now up to a day ahead is tonight; later or past is paused", () => {
    const v = view([
      inst({ instanceId: "now", startsAt: NOW }),
      inst({ instanceId: "in-a-day", startsAt: NOW + D }),
      inst({ instanceId: "past-a-day", startsAt: NOW + D + 1 }),
      inst({ instanceId: "started", startsAt: NOW - 1 }),
      inst({ instanceId: "unscheduled" }),
    ]);
    expect(kinds(v)).toEqual({
      now: "tonight",
      "in-a-day": "tonight",
      "past-a-day": "paused",
      started: "paused",
      unscheduled: "paused",
    });
  });

  it("a finished game shows for exactly one day", () => {
    const v = view([
      inst({ instanceId: "edge", status: "completed", updatedAt: NOW - D }),
      inst({ instanceId: "gone", status: "completed", updatedAt: NOW - D - 1 }),
    ]);
    expect(kinds(v)).toEqual({ edge: "finished" });
  });

  it("a finished game outlives a short TTL for its day", () => {
    const v = view(
      [inst({ instanceId: "done", status: "completed", updatedAt: NOW - 2 * H })],
      [],
      () => H,
    );
    expect(kinds(v)).toEqual({ done: "finished" });
  });

  it("an instance silent for exactly its game's TTL is still listed; a moment longer is hidden", () => {
    const ttlFor = (appId: string) => (appId === "short" ? H : week());
    const v = view(
      [
        inst({ instanceId: "edge", appId: "short", updatedAt: NOW - H }),
        inst({ instanceId: "stale", appId: "short", updatedAt: NOW - H - 1 }),
        inst({ instanceId: "long", appId: "long", updatedAt: NOW - 2 * H }),
      ],
      [],
      ttlFor,
    );
    expect(kinds(v)).toEqual({ edge: "paused", long: "paused" });
  });

  it("reported instances of the same game are all listed, newest first", () => {
    const v = view([
      inst({ instanceId: "older", updatedAt: NOW - 3 * H }),
      inst({ instanceId: "newest", updatedAt: NOW - 1 * H }),
      inst({ instanceId: "middle", updatedAt: NOW - 2 * H }),
    ]);
    expect(v.sections).toHaveLength(1);
    expect(v.sections[0]?.items.map((i) => i.instanceId)).toEqual(["newest", "middle", "older"]);
  });

  // Owner, 2026-10-04: several sittings of one game (two Catan games) each get their own row.
  it("Tier 0 visits with distinct ids stay separate, alongside other games and reported instances", () => {
    const v = view([
      inst({ instanceId: "pg-old", appId: "peekaboo", source: "visit", updatedAt: NOW - 2 * H }),
      inst({ instanceId: "pg-new", appId: "peekaboo", source: "visit", updatedAt: NOW - H }),
      inst({ instanceId: "bs", appId: "bake-shop", source: "visit", updatedAt: NOW - 3 * H }),
      inst({
        instanceId: "pg-reported",
        appId: "peekaboo",
        source: "server",
        updatedAt: NOW - 4 * H,
      }),
    ]);
    expect(v.sections[0]?.items.map((i) => i.instanceId)).toEqual([
      "pg-new",
      "pg-old",
      "bs",
      "pg-reported",
    ]);
  });

  it("a Tier 0 visit still shows when the game also reported a newer instance", () => {
    const v = view([
      inst({ instanceId: "visit", appId: "peekaboo", source: "visit", updatedAt: NOW - 2 * H }),
      inst({ instanceId: "reported", appId: "peekaboo", source: "bridge", updatedAt: NOW - H }),
    ]);
    expect(v.sections[0]?.items.map((i) => i.instanceId)).toEqual(["reported", "visit"]);
  });

  it("the live game is pinned once, not repeated in its section", () => {
    const v = view(
      [
        inst({ instanceId: "rc", status: "active" }),
        inst({ instanceId: "bake", appId: "bake-shop" }),
      ],
      ["rc"],
    );
    expect(v.live?.instanceId).toBe("rc");
    expect(kinds(v)).toEqual({ bake: "paused" });
  });

  it("a completed game on a screen isn't pinned as live; it shows as finished", () => {
    const v = view([inst({ instanceId: "rc", status: "completed" })], ["rc"]);
    expect(v.live).toBeNull();
    expect(kinds(v)).toEqual({ rc: "finished" });
  });

  it("nothing is live when no listed instance is on a screen", () => {
    expect(view([inst({ instanceId: "rc" })], ["other"]).live).toBeNull();
  });
});
