import {
  type Instance,
  initialSession,
  type Manifest,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { newSittingId, playedAgo, sittingsFor, sittingToOpen } from "../sittings";

const MIN = 60 * 1000;
const H = 60 * MIN;
const DAY = 24 * H;
const NOW = 100 * DAY;

const game = (appId = "catan"): Manifest => ({
  appId,
  name: "Catan",
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: `https://${appId}.example/`,
  tvUrl: `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 7 * DAY,
});

const inst = (instanceId: string, patch: Partial<Instance> = {}): Instance => ({
  instanceId,
  appId: "catan",
  profileId: "pr1",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: NOW - H,
  source: "bridge",
  ...patch,
});

const session = (patch: Partial<SessionState>): SessionState => ({
  ...initialSession("s1", "pr1"),
  ...patch,
});

const current = (
  instanceId: string,
  patch: Partial<NonNullable<SessionState["current"]>> = {},
) => ({
  appId: "catan",
  instanceId,
  mode: "continue" as const,
  roster: [],
  label: "",
  startedAt: NOW - 5 * MIN,
  viewUrl: null,
  hostDeviceId: null,
  ...patch,
});

describe("sittingsFor: your in-progress sittings of one game", () => {
  it("is empty for a game you never played", () => {
    expect(sittingsFor(game(), [], null, NOW)).toEqual([]);
  });

  it("lists two games of Catan as two sittings, most recent first", () => {
    const list = sittingsFor(
      game(),
      [inst("c-old", { updatedAt: NOW - 2 * DAY }), inst("c-new", { updatedAt: NOW - H })],
      null,
      NOW,
    );
    expect(list.map((s) => s.instanceId)).toEqual(["c-new", "c-old"]);
  });

  it("keeps only this game's sittings", () => {
    const list = sittingsFor(game(), [inst("c1"), inst("b1", { appId: "bake-shop" })], null, NOW);
    expect(list.map((s) => s.instanceId)).toEqual(["c1"]);
  });

  it("drops finished, expired and stale sittings (the Playing rules)", () => {
    const list = sittingsFor(
      game(),
      [
        inst("done", { status: "completed" }),
        inst("gone", { status: "expired" }),
        inst("stale", { updatedAt: NOW - 7 * DAY - 1 }),
        inst("edge", { updatedAt: NOW - 7 * DAY }),
      ],
      null,
      NOW,
    );
    expect(list.map((s) => s.instanceId)).toEqual(["edge"]);
  });

  it("carries the instance's resume URL, title and when it was last played", () => {
    const [s] = sittingsFor(
      game(),
      [inst("c1", { title: "Turn 12", resumeUrl: "https://catan.example/r/AB" })],
      null,
      NOW,
    );
    expect(s).toEqual({
      instanceId: "c1",
      label: "Turn 12",
      at: NOW - H,
      resumeUrl: "https://catan.example/r/AB",
      live: false,
    });
  });

  it("uses the detail when there is no title", () => {
    const [s] = sittingsFor(game(), [inst("c1", { detail: "Your move" })], null, NOW);
    expect(s?.label).toBe("Your move");
  });

  it("a visit's title is just the game's name, so it has no label of its own", () => {
    const [s] = sittingsFor(game(), [inst("c1", { source: "visit", title: "Catan" })], null, NOW);
    expect(s?.label).toBe("");
  });

  it("includes the couch session's paused sitting even before its instance is recorded", () => {
    const s = session({
      suspended: [{ appId: "catan", instanceId: "c-p", label: "Mission 6", at: NOW - 2 * MIN }],
    });
    expect(sittingsFor(game(), [], s, NOW)).toEqual([
      {
        instanceId: "c-p",
        label: "Mission 6",
        at: NOW - 2 * MIN,
        resumeUrl: undefined,
        live: false,
      },
    ]);
  });

  it("includes the live sitting first, marked live", () => {
    const s = session({ current: current("c-live") });
    const list = sittingsFor(game(), [inst("c-other", { updatedAt: NOW - MIN })], s, NOW);
    expect(list.map((x) => [x.instanceId, x.live])).toEqual([
      ["c-live", true],
      ["c-other", false],
    ]);
  });

  it("merges a session sitting with its instance: one row, the session's label, the newest time, the URL", () => {
    const s = session({
      suspended: [{ appId: "catan", instanceId: "c1", label: "Mission 6", at: NOW - 10 * MIN }],
    });
    const list = sittingsFor(
      game(),
      [
        inst("c1", {
          title: "Old title",
          updatedAt: NOW - 2 * MIN,
          resumeUrl: "https://catan.example/r/AB",
        }),
      ],
      s,
      NOW,
    );
    expect(list).toEqual([
      {
        instanceId: "c1",
        label: "Mission 6",
        at: NOW - 2 * MIN,
        resumeUrl: "https://catan.example/r/AB",
        live: false,
      },
    ]);
  });

  it("keeps the instance's title when the session has no resume point", () => {
    const s = session({
      suspended: [{ appId: "catan", instanceId: "c1", label: "", at: NOW - H - 1 }],
    });
    const [x] = sittingsFor(game(), [inst("c1", { title: "Turn 12" })], s, NOW);
    expect(x).toMatchObject({ label: "Turn 12", at: NOW - H });
  });

  it("a paused sitting whose game reported it finished is gone", () => {
    const s = session({ suspended: [{ appId: "catan", instanceId: "c1", label: "", at: NOW }] });
    expect(sittingsFor(game(), [inst("c1", { status: "completed" })], s, NOW)).toEqual([]);
  });

  it("ignores other games' session sittings", () => {
    const s = session({
      current: current("b-live", { appId: "bake-shop" }),
      suspended: [{ appId: "bake-shop", instanceId: "b1", label: "", at: NOW }],
    });
    expect(sittingsFor(game(), [], s, NOW)).toEqual([]);
  });
});

describe("playedAgo: when a sitting was last played", () => {
  it.each([
    [0, "Just now"],
    [59 * 1000, "Just now"],
    [MIN, "1 min ago"],
    [59 * MIN, "59 min ago"],
    [H, "1 hour ago"],
    [5 * H, "5 hours ago"],
    [DAY - 1, "23 hours ago"],
    [DAY, "Yesterday"],
    [2 * DAY - 1, "Yesterday"],
    [2 * DAY, "2 days ago"],
    [6 * DAY, "6 days ago"],
  ])("%d ms ago reads %s", (ago, text) => {
    expect(playedAgo(NOW - ago, NOW)).toBe(text);
  });

  it("a time a moment in the future (clock skew) reads Just now", () => {
    expect(playedAgo(NOW + 5000, NOW)).toBe("Just now");
  });
});

describe("newSittingId: a fresh sitting's id", () => {
  it("is the game id plus the time, like the couch session's own ids", () => {
    expect(newSittingId("catan", 1000)).toBe(`catan-${(1000).toString(36)}`);
  });
});

describe("sittingToOpen: which sitting a game screen opens", () => {
  it("Rejoin of a named sitting opens that one", () => {
    expect(sittingToOpen("catan", { instanceId: "c1", resumeUrl: "https://x/r" }, 1000)).toBe("c1");
  });

  it("the start page is a fresh sitting", () => {
    expect(sittingToOpen("catan", {}, 1000)).toBe(newSittingId("catan", 1000));
  });

  it("a resume URL without a sitting (an old pill) stays unknown", () => {
    expect(sittingToOpen("catan", { resumeUrl: "https://x/r" }, 1000)).toBeUndefined();
  });
});
