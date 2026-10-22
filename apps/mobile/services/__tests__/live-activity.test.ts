import { initialSession, type SessionState } from "@open-game-system/ogs-protocol";
import type { LiveActivityNative } from "@open-game-system/shell/modules/live-activity-native";
import { createAppLiveActivity, liveActivitiesBuilt } from "../live-activity";

/**
 * The OGS app's Live Activity, wired the way runtime.ts wires it, over a fake ActivityKit module:
 * the couch session drives start / relabel / end, the open game's reports update the status, the
 * push token goes to OGS under the couch session.
 */
function fakeNative() {
  const log: [string, ...unknown[]][] = [];
  let token: ((e: { activityId: string; token: string }) => void) | null = null;
  const native: LiveActivityNative = {
    isEnabled: () => true,
    start: async (attributes, content) => {
      log.push(["start", attributes, content.status]);
      return "act-1";
    },
    update: async (_id, content) => {
      log.push(["update", content.status]);
    },
    end: async (_id, content) => {
      log.push(["end", content.status]);
    },
    prepareArt: async (url, name) => {
      log.push(["art", url, name]);
      return name;
    },
    onPushToken: (l) => {
      token = l;
      return () => {
        token = null;
      };
    },
    onStateChange: () => () => {},
  };
  return { native, log, pushToken: (t: string) => token?.({ activityId: "act-1", token: t }) };
}

function fakeCouch() {
  let state: SessionState | null = null;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(next: SessionState | null) {
      state = next;
      for (const l of [...listeners]) l();
    },
  };
}

const ROCKET_CREW = {
  name: "Rocket Crew",
  art: { tile: "/art/rocket-crew/tile.png", icon: "/art/rocket-crew/icon.png" },
};

const playing = (label: string, appId = "rocket-crew"): SessionState => ({
  ...initialSession("s1", "mom"),
  cast: true,
  screen: "game",
  current: {
    appId,
    instanceId: "i",
    mode: "new",
    roster: [],
    label,
    startedAt: 1,
    viewUrl: null,
    hostDeviceId: null,
  },
});

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 2));
  if (!check()) throw new Error("timed out");
};

function setup() {
  const fake = fakeNative();
  const couch = fakeCouch();
  const posts: unknown[] = [];
  const clock = { t: 1_000 };
  const live = createAppLiveActivity({
    native: fake.native,
    couch,
    findGame: (appId) => (appId === "rocket-crew" ? ROCKET_CREW : undefined),
    session: () => ({ sessionId: "s1", code: "KXTE42" }),
    tvBase: "https://tv.test",
    scheme: "opengame",
    environment: async () => "production",
    post: async (sid, registration) => {
      posts.push([sid, registration]);
    },
    now: () => clock.t,
  });
  return { ...fake, couch, posts, clock, live };
}

afterEach(() => jest.restoreAllMocks());

describe("liveActivitiesBuilt", () => {
  it("is true only when the plugin wrote extra.ogsLiveActivities", () => {
    expect(liveActivitiesBuilt({ extra: { ogsLiveActivities: true } })).toBe(true);
    expect(liveActivitiesBuilt({ extra: {} })).toBe(false);
    expect(liveActivitiesBuilt({ extra: { ogsLiveActivities: "true" } })).toBe(false);
    expect(liveActivitiesBuilt(null)).toBe(false);
  });
});

describe("the OGS app's controller Live Activity", () => {
  it("a game on the cast TV starts it: name, icon art, TV code, a link back to the game", async () => {
    const { couch, log, live } = setup();
    couch.set(playing(""));
    await until(() => log.some((l) => l[0] === "start"));
    expect(log).toEqual([
      ["art", "https://tv.test/art/rocket-crew/icon.png", "rocket-crew.png"],
      [
        "start",
        {
          appId: "rocket-crew",
          gameName: "Rocket Crew",
          deepLink: "opengame://live-activity/rocket-crew",
          roomCode: "KXTE42",
          art: "rocket-crew.png",
        },
        "Playing on the TV",
      ],
    ]);
    live.stop();
  });

  it("the open game's report updates it; another game's report doesn't", async () => {
    const { couch, log, clock, live } = setup();
    couch.set(playing(""));
    await until(() => log.some((l) => l[0] === "start"));
    await new Promise((r) => setTimeout(r, 0));
    clock.t += 5_000;
    live.report({ instanceId: "x", appId: "story-nook", status: "lobby", title: "", detail: "" });
    live.report({
      instanceId: "i",
      appId: "rocket-crew",
      status: "active",
      title: "Round 3",
      detail: "",
      yourTurn: true,
    });
    await until(() => log.some((l) => l[0] === "update"));
    expect(log.filter((l) => l[0] === "update")).toEqual([["update", "Round 3 · Your turn"]]);
    live.stop();
  });

  it("the TV's label relabels it and the cast ending ends it", async () => {
    const { couch, log, clock, live } = setup();
    couch.set(playing(""));
    await until(() => log.some((l) => l[0] === "start"));
    await new Promise((r) => setTimeout(r, 0));
    clock.t += 5_000;
    couch.set(playing("Mission 6"));
    await until(() => log.some((l) => l[0] === "update"));
    couch.set({ ...playing("Mission 6"), cast: false });
    await until(() => log.some((l) => l[0] === "end"));
    expect(log.slice(-2)).toEqual([
      ["update", "Mission 6"],
      ["end", "Game over"],
    ]);
    live.stop();
  });

  it("registers its push token as the OGS app's under the couch session", async () => {
    const { couch, log, posts, pushToken, live } = setup();
    couch.set(playing(""));
    await until(() => log.some((l) => l[0] === "start"));
    await new Promise((r) => setTimeout(r, 0));
    pushToken("abcd");
    await until(() => posts.length > 0);
    expect(posts).toEqual([
      ["s1", { activityId: "act-1", pushToken: "abcd", app: "ogs", environment: "production" }],
    ]);
    live.stop();
  });

  it("a game the app doesn't know starts nothing", async () => {
    const { couch, log, live } = setup();
    couch.set(playing("", "mystery"));
    await new Promise((r) => setTimeout(r, 10));
    expect(log).toEqual([]);
    live.stop();
  });
});
