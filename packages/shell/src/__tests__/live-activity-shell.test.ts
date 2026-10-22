import type { LiveActivityAttributes, LiveActivityContent } from "@open-game-system/ogs-protocol";
import { fakeContext } from "../__fixtures__/fake-context";
import { fakeFetch } from "../__fixtures__/fake-fetch";
import { createCastStore } from "../cast-store";
import type { LiveActivityNative } from "../live-activity-native";
import { shellLiveActivity } from "../live-activity-shell";
import { createOgsBridgeStore } from "../ogs-bridge";

jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

/**
 * The single-game app's Live Activity, end to end through the shell's own pieces: the cast store,
 * the game's `ogs` store, the OGS API (fake fetch) and a fake ActivityKit module.
 */
function fakeNative() {
  const log: (
    | ["start", LiveActivityAttributes, LiveActivityContent]
    | ["update" | "end", string, LiveActivityContent]
    | ["art", string, string]
  )[] = [];
  let token: ((e: { activityId: string; token: string }) => void) | null = null;
  const native: LiveActivityNative = {
    isEnabled: () => true,
    start: async (attributes, content) => {
      log.push(["start", attributes, content]);
      return "act-1";
    },
    update: async (id, content) => {
      log.push(["update", id, content]);
    },
    end: async (id, content) => {
      log.push(["end", id, content]);
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
  return {
    native,
    log,
    pushToken: (activityId: string, t: string) => token?.({ activityId, token: t }),
  };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

const IDENTITY = {
  profile: { id: "p", handle: "player", name: "Player", sticker: "owl" },
  deviceId: "d",
  deviceToken: "device-token",
  login: "guest" as const,
};

const clock = { t: 1_000 };
beforeEach(() => {
  clock.t = 1_000;
});

function setup(
  catalogue: unknown = [
    { appId: "settlewood", art: { tile: "/art/sw/tile.png", icon: "/art/sw/icon.png" } },
  ],
) {
  const net = fakeFetch({
    "GET /api/v1/catalogue": () => ({ status: 200, body: catalogue }),
    "POST /api/v1/sessions/s-1/live-activities": () => ({
      status: 201,
      body: { activityId: "act-1" },
    }),
  });
  const { ctx, setIdentity, stop } = fakeContext(net.fetch, {
    appId: "settlewood",
    name: "Settlewood",
    schemes: ["settlewood"],
    tvBase: "https://tv.test",
    liveActivities: true,
  });
  setIdentity(IDENTITY);
  const fake = fakeNative();
  const live = shellLiveActivity(ctx, {
    native: fake.native,
    environment: async () => "sandbox",
    now: () => clock.t,
  });
  const posted: string[] = [];
  const stores = live.attach({
    cast: createCastStore(),
    ogs: createOgsBridgeStore(async (r) => {
      posted.push(r.title);
    }),
  });
  return { ...fake, net, live, stores, stop, posted };
}

const connect = (cast: ReturnType<typeof createCastStore>) =>
  cast.dispatch({
    type: "SESSION_CONNECTED",
    deviceId: "tv",
    deviceName: "Living room TV",
    sessionId: "cast-1",
    streamSessionId: "",
  });

describe("shellLiveActivity", () => {
  it("starts when the cast connects: game name, catalogue art, TV code, deep link", async () => {
    const { live, stores, log } = setup();
    live.onSession({ sessionId: "s-1", code: "KQTP42" });
    connect(stores.cast);
    await until(() => log.some((l) => l[0] === "start"));
    expect(log[0]).toEqual(["art", "https://tv.test/art/sw/icon.png", "settlewood.png"]);
    expect(log[1]).toEqual([
      "start",
      {
        appId: "settlewood",
        gameName: "Settlewood",
        deepLink: "settlewood://live-activity/settlewood",
        roomCode: "KQTP42",
        art: "settlewood.png",
      },
      { phase: "playing", status: "Playing on the TV", yourTurn: false, updatedAt: 1_000 },
    ]);
  });

  it("the game's report updates it and still reaches OGS; the cast ending ends it", async () => {
    const { live, stores, log, posted } = setup();
    live.onSession({ sessionId: "s-1", code: null });
    connect(stores.cast);
    await until(() => log.some((l) => l[0] === "start"));
    await new Promise((r) => setTimeout(r, 0));
    clock.t += 5_000;
    stores.ogs.dispatch({
      type: "INSTANCE_REPORT",
      report: {
        instanceId: "i",
        appId: "settlewood",
        status: "waiting",
        title: "Round 3",
        yourTurn: true,
      },
    });
    await until(() => log.some((l) => l[0] === "update"));
    expect(log.find((l) => l[0] === "update")?.[2]).toMatchObject({
      status: "Round 3 · Your turn",
    });
    expect(posted).toEqual(["Round 3"]);
    stores.cast.dispatch({ type: "SESSION_ENDED" });
    await until(() => log.some((l) => l[0] === "end"));
  });

  it("registers the activity's push token under the cast's couch session", async () => {
    const { live, stores, log, net, pushToken } = setup();
    live.onSession({ sessionId: "s-1", code: null });
    connect(stores.cast);
    await until(() => log.some((l) => l[0] === "start"));
    await new Promise((r) => setTimeout(r, 0));
    pushToken("act-1", "abcd");
    await until(() => net.calls.some((c) => c.method === "POST"));
    const call = net.calls.find((c) => c.method === "POST");
    expect(call?.url).toBe("https://api.test/api/v1/sessions/s-1/live-activities");
    expect(call?.headers.Authorization).toBe("Bearer device-token");
    expect(call?.body).toEqual({
      activityId: "act-1",
      pushToken: "abcd",
      app: "settlewood",
      environment: "sandbox",
    });
  });

  it("a game not in the catalogue (or no catalogue) gets the monogram: no art", async () => {
    for (const catalogue of [[], "not a catalogue"]) {
      const { stores, log } = setup(catalogue);
      connect(stores.cast);
      await until(() => log.some((l) => l[0] === "start"));
      const start = log.find((l) => l[0] === "start");
      expect(start?.[1]).not.toHaveProperty("art");
      expect(log.some((l) => l[0] === "art")).toBe(false);
    }
  });

  it("stopping the shell stops following the cast", async () => {
    const { stores, log, stop } = setup();
    stop();
    connect(stores.cast);
    await new Promise((r) => setTimeout(r, 20));
    expect(log).toEqual([]);
  });
});
