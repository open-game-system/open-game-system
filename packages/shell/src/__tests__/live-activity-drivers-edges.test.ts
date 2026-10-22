import { initialSession, type SessionState } from "@open-game-system/ogs-protocol";
import { fakeContext } from "../__fixtures__/fake-context";
import { fakeFetch } from "../__fixtures__/fake-fetch";
import { createCastStore } from "../cast-store";
import {
  artUrlOf,
  followCouch,
  liveActivityAttributes,
  registerPushTokens,
} from "../live-activity-drivers";
import { LIVE_ACTIVITY_MODULE, liveActivityNativeFrom } from "../live-activity-native";
import { shellLiveActivity } from "../live-activity-shell";
import { createOgsBridgeStore } from "../ogs-bridge";

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe("attributes and art, edges", () => {
  it("a 40-character name is kept whole", () => {
    const name = "N".repeat(40);
    expect(liveActivityAttributes({ appId: "x", gameName: name, scheme: "s" }).gameName).toBe(name);
  });

  it("keeps http and https art as it is, only at the start of the path", () => {
    expect(artUrlOf("http://cdn.example/a.png", "https://tv.example")).toBe(
      "http://cdn.example/a.png",
    );
    expect(artUrlOf("/x/https://a.png", "https://tv.example")).toBe(
      "https://tv.example/x/https://a.png",
    );
    expect(artUrlOf("/a.png", "https://tv.example//")).toBe("https://tv.example/a.png");
  });

  it("logs a refused token registration with what failed", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    registerPushTokens({
      sessionId: () => "s1",
      app: "ogs",
      environment: async () => "sandbox",
      post: async () => Promise.reject(new Error("403")),
    })({ activityId: "a", pushToken: "b" });
    await flush();
    expect(warn).toHaveBeenCalledWith(
      "[ogs-shell] could not register the Live Activity token:",
      expect.any(Error),
    );
    warn.mockRestore();
  });
});

describe("the native module, edges", () => {
  it("is the OgsLiveActivity module", () => {
    expect(LIVE_ACTIVITY_MODULE).toBe("OgsLiveActivity");
  });

  it.each([
    "active",
    "ended",
    "dismissed",
    "stale",
    "pending",
  ])("passes on the %s state", (state) => {
    const handlers: ((p: unknown) => void)[] = [];
    const mod = {
      areActivitiesEnabled: () => true,
      startActivity: async () => "a",
      updateActivity: async () => {},
      endActivity: async () => {},
      prepareArt: async () => null,
      addListener: (_e: string, h: (p: unknown) => void) => {
        handlers.push(h);
        return null;
      },
    };
    const got: string[] = [];
    const off = liveActivityNativeFrom(mod)?.onStateChange((e) => got.push(e.state));
    for (const h of handlers) h({ activityId: "a", state });
    expect(got).toEqual([state]);
    expect(() => off?.()).not.toThrow();
  });
});

const casting = (label: string, appId = "rocket-crew"): SessionState => ({
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

function subscribe(listeners: Set<() => void>, l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

describe("followCouch, races", () => {
  it("a game whose attributes come after the couch moved on to another game doesn't start", async () => {
    const joins: string[] = [];
    let state: SessionState | null = null;
    const listeners = new Set<() => void>();
    const resolvers: (() => void)[] = [];
    followCouch(
      { join: (a) => joins.push(a.appId), report: () => {}, end: () => {}, current: () => null },
      { getState: () => state, subscribe: (l) => subscribe(listeners, l) },
      (appId) =>
        new Promise((resolve) =>
          resolvers.push(() => resolve({ appId, gameName: appId, deepLink: "d" })),
        ),
    );
    state = casting("A", "rocket-crew");
    for (const l of listeners) l();
    state = casting("B", "story-nook");
    for (const l of listeners) l();
    for (const r of resolvers) r();
    await flush();
    expect(joins).toEqual(["story-nook"]);
  });

  it("leaving the couch while the attributes load starts nothing", async () => {
    const joins: string[] = [];
    let state: SessionState | null = casting("A");
    const listeners = new Set<() => void>();
    let resolve: () => void = () => {};
    followCouch(
      { join: (a) => joins.push(a.appId), report: () => {}, end: () => {}, current: () => null },
      { getState: () => state, subscribe: (l) => subscribe(listeners, l) },
      (appId) => new Promise((r) => (resolve = () => r({ appId, gameName: appId, deepLink: "d" }))),
    );
    state = null;
    for (const l of listeners) l();
    resolve();
    await flush();
    expect(joins).toEqual([]);
  });
});

const IDENTITY = {
  profile: { id: "p", handle: "player", name: "Player", sticker: "owl" },
  deviceId: "d",
  deviceToken: "device-token",
  login: "guest" as const,
};

function shellSetup(
  opts: {
    catalogue?: () => { status: number; body?: unknown };
    signedIn?: boolean;
    schemes?: string[];
  } = {},
) {
  const starts: unknown[] = [];
  const disposed: string[] = [];
  let token: ((e: { activityId: string; token: string }) => void) | null = null;
  const net = fakeFetch({
    "GET /api/v1/catalogue": opts.catalogue ?? (() => ({ status: 200, body: [] })),
    "POST /api/v1/sessions/s-1/live-activities": () => ({
      status: 201,
      body: { activityId: "act-1" },
    }),
  });
  const { ctx, setIdentity, stop } = fakeContext(net.fetch, {
    appId: "settlewood",
    name: "Settlewood",
    ...(opts.schemes ? { schemes: opts.schemes } : {}),
  });
  if (opts.signedIn !== false) setIdentity(IDENTITY);
  const live = shellLiveActivity(ctx, {
    native: {
      isEnabled: () => true,
      start: async (attributes) => {
        starts.push(attributes);
        return "act-1";
      },
      update: async () => {},
      end: async () => {},
      prepareArt: async (_u, name) => name,
      onPushToken: (l) => {
        token = l;
        return () => disposed.push("token");
      },
      onStateChange: () => () => disposed.push("state"),
    },
    environment: async () => "production",
  });
  const stores = live.attach({
    cast: createCastStore(),
    ogs: createOgsBridgeStore(async () => {}),
  });
  const connect = () =>
    stores.cast.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: "tv",
      deviceName: "TV",
      sessionId: "c",
      streamSessionId: "",
    });
  return {
    live,
    stores,
    starts,
    net,
    stop,
    disposed,
    connect,
    token: (t: string) => token?.({ activityId: "act-1", token: t }),
  };
}

describe("shellLiveActivity, edges", () => {
  it("finds its own game in a catalogue of several, and links with the appId scheme by default", async () => {
    const s = shellSetup({
      catalogue: () => ({
        status: 200,
        body: [
          { appId: "rocket-crew", art: { tile: "/rc.png" } },
          { appId: "settlewood", art: { tile: "/sw-tile.png" } },
        ],
      }),
    });
    s.connect();
    for (let i = 0; i < 50 && s.starts.length === 0; i++)
      await new Promise((r) => setTimeout(r, 2));
    expect(s.starts[0]).toMatchObject({
      deepLink: "settlewood://live-activity/settlewood",
      art: "settlewood.png",
    });
  });

  it("uses the app's own scheme when it has one", async () => {
    const s = shellSetup({ schemes: ["sw"] });
    s.connect();
    for (let i = 0; i < 50 && s.starts.length === 0; i++)
      await new Promise((r) => setTimeout(r, 2));
    expect(s.starts[0]).toMatchObject({ deepLink: "sw://live-activity/settlewood" });
  });

  it("a catalogue that fails leaves the art out", async () => {
    const s = shellSetup({ catalogue: () => ({ status: 500 }) });
    s.connect();
    for (let i = 0; i < 50 && s.starts.length === 0; i++)
      await new Promise((r) => setTimeout(r, 2));
    expect(s.starts[0]).not.toHaveProperty("art");
  });

  it("registers nothing before a cast made a session, or without a profile", async () => {
    const s = shellSetup({ signedIn: false });
    s.connect();
    for (let i = 0; i < 50 && s.starts.length === 0; i++)
      await new Promise((r) => setTimeout(r, 2));
    await flush();
    s.token("abcd");
    await flush();
    s.live.onSession({ sessionId: "s-1", code: null });
    s.token("abcd");
    await flush();
    expect(s.net.calls.filter((c) => c.method === "POST")).toEqual([]);
  });

  it("checks OGS answered with the activity id", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const net = fakeFetch({
      "POST /api/v1/sessions/s-1/live-activities": () => ({ status: 201, body: {} }),
      "GET /api/v1/catalogue": () => ({ status: 200, body: [] }),
    });
    const { ctx, setIdentity } = fakeContext(net.fetch, { appId: "settlewood" });
    setIdentity(IDENTITY);
    const holder: { token: ((e: { activityId: string; token: string }) => void) | null } = {
      token: null,
    };
    const live = shellLiveActivity(ctx, {
      native: {
        isEnabled: () => true,
        start: async () => "act-1",
        update: async () => {},
        end: async () => {},
        prepareArt: async () => null,
        onPushToken: (l) => {
          holder.token = l;
          return () => {};
        },
        onStateChange: () => () => {},
      },
      environment: async () => "production",
    });
    const stores = live.attach({
      cast: createCastStore(),
      ogs: createOgsBridgeStore(async () => {}),
    });
    live.onSession({ sessionId: "s-1", code: null });
    stores.cast.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: "tv",
      deviceName: "TV",
      sessionId: "c",
      streamSessionId: "",
    });
    for (let i = 0; i < 50 && !live.activity.current(); i++)
      await new Promise((r) => setTimeout(r, 2));
    holder.token?.({ activityId: "act-1", token: "abcd" });
    for (let i = 0; i < 50 && warn.mock.calls.length === 0; i++)
      await new Promise((r) => setTimeout(r, 2));
    expect(warn).toHaveBeenCalled();
  });

  it("stopping the shell disposes the activity's listeners", () => {
    const s = shellSetup();
    s.stop();
    expect(s.disposed.sort()).toEqual(["state", "token"]);
  });
});
