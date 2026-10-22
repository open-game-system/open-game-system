import {
  initialSession,
  type LiveActivityAttributes,
  type LiveActivityStatus,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { CAST_INITIAL_STATE, type CastSession } from "../cast-store";
import {
  artUrlOf,
  followCastSession,
  followCouch,
  liveActivityAttributes,
  prepareArt,
  registerPushTokens,
  reportToActivity,
  teeStore,
} from "../live-activity-drivers";
import { createOgsBridgeStore } from "../ogs-bridge";

type Op =
  | ["join", string, LiveActivityStatus | undefined]
  | ["report", LiveActivityStatus]
  | ["end"];

function fakeActivity() {
  const ops: Op[] = [];
  let current: { id: string; appId: string } | null = null;
  return {
    ops,
    activity: {
      join(attrs: LiveActivityAttributes, status?: LiveActivityStatus) {
        ops.push(["join", attrs.appId, status]);
        current = { id: "act", appId: attrs.appId };
      },
      report(status: LiveActivityStatus) {
        ops.push(["report", status]);
      },
      end() {
        ops.push(["end"]);
        current = null;
      },
      current: () => current,
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("liveActivityAttributes", () => {
  it("names the game, links back to the controller, and carries code and art when known", () => {
    expect(
      liveActivityAttributes({
        appId: "rocket-crew",
        gameName: " Rocket Crew ",
        scheme: "opengame",
        roomCode: "KXTE42",
        art: "rocket-crew.png",
      }),
    ).toEqual({
      appId: "rocket-crew",
      gameName: "Rocket Crew",
      deepLink: "opengame://live-activity/rocket-crew",
      roomCode: "KXTE42",
      art: "rocket-crew.png",
    });
  });

  it("leaves out a missing code and art, clips a long name, and falls back to the appId", () => {
    const a = liveActivityAttributes({ appId: "x", gameName: "N".repeat(60), scheme: "s" });
    expect(a).toEqual({
      appId: "x",
      gameName: `${"N".repeat(39)}…`,
      deepLink: "s://live-activity/x",
    });
    expect(
      liveActivityAttributes({ appId: "x", gameName: "  ", scheme: "s", roomCode: null }).gameName,
    ).toBe("x");
  });
});

describe("art", () => {
  it("resolves launcher-relative art against the TV base", () => {
    expect(artUrlOf("/art/rc/icon.png", "https://tv.example/")).toBe(
      "https://tv.example/art/rc/icon.png",
    );
    expect(artUrlOf("art/rc/icon.png", "https://tv.example")).toBe(
      "https://tv.example/art/rc/icon.png",
    );
    expect(artUrlOf("https://cdn.example/rc.png", "https://tv.example")).toBe(
      "https://cdn.example/rc.png",
    );
  });

  it("saves it as <appId>.png, and is null without a module, a URL, or on failure", async () => {
    const native = { prepareArt: jest.fn(async (_url: string, name: string) => name) };
    expect(await prepareArt(native, "https://a/icon.webp", "rc")).toBe("rc.png");
    expect(native.prepareArt).toHaveBeenCalledWith("https://a/icon.webp", "rc.png");
    expect(await prepareArt(null, "https://a/icon.webp", "rc")).toBeNull();
    expect(await prepareArt(native, null, "rc")).toBeNull();
    expect(
      await prepareArt({ prepareArt: async () => Promise.reject(new Error("offline")) }, "u", "rc"),
    ).toBeNull();
  });
});

describe("the game's own reports (INSTANCE_REPORT over the ogs store)", () => {
  const report = {
    instanceId: "i",
    appId: "rocket-crew",
    status: "active",
    title: "Round 3",
    yourTurn: true,
  };

  it("become the status line", () => {
    const { activity, ops } = fakeActivity();
    reportToActivity(activity)({ type: "INSTANCE_REPORT", report });
    expect(ops).toEqual([
      ["report", { phase: "playing", status: "Round 3 · Your turn", yourTurn: true }],
    ]);
  });

  it("ignore other games' reports and anything that isn't a report", () => {
    const { activity, ops } = fakeActivity();
    const onEvent = reportToActivity(activity, "story-nook");
    onEvent({ type: "INSTANCE_REPORT", report });
    onEvent({ type: "INSTANCE_REPORT" });
    onEvent({ type: "OTHER" });
    onEvent(null);
    expect(ops).toEqual([]);
  });

  it("teeStore hands each event on and still dispatches it to the store", () => {
    const posted: unknown[] = [];
    const store = createOgsBridgeStore(async (r) => {
      posted.push(r.instanceId);
    });
    const seen: unknown[] = [];
    const tee = teeStore(store, (e) => seen.push(e.type));
    tee.dispatch({ type: "INSTANCE_REPORT", report });
    expect(seen).toEqual(["INSTANCE_REPORT"]);
    expect(posted).toEqual(["i"]);
    expect(tee.getSnapshot()).toEqual({ reported: ["rocket-crew"] });
    const listener = jest.fn();
    const off = tee.subscribe(listener);
    tee.reset();
    off();
    expect(tee.getSnapshot()).toEqual({ reported: [] });
    expect(typeof tee.on("x", () => {})).toBe("function");
  });
});

function fakeCast() {
  let session: CastSession = CAST_INITIAL_STATE.session;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => ({ session }),
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(status: CastSession["status"]) {
      session = { ...session, status };
      for (const l of [...listeners]) l();
    },
    size: () => listeners.size,
  };
}

const ATTRS: LiveActivityAttributes = {
  appId: "settlewood",
  gameName: "Settlewood",
  deepLink: "settlewood://live-activity/settlewood",
};

describe("followCastSession (a game's own app)", () => {
  it("joins when the cast connects and ends when it disconnects", async () => {
    const { activity, ops } = fakeActivity();
    const cast = fakeCast();
    const off = followCastSession(activity, cast, async () => ATTRS);
    cast.set("connecting");
    cast.set("connected");
    await flush();
    cast.set("connected");
    await flush();
    expect(ops).toEqual([["join", "settlewood", undefined]]);
    cast.set("disconnected");
    expect(ops).toEqual([["join", "settlewood", undefined], ["end"]]);
    off();
    expect(cast.size()).toBe(0);
  });

  it("joins at once when the app starts on a running cast session", async () => {
    const { activity, ops } = fakeActivity();
    const cast = fakeCast();
    cast.set("connected");
    followCastSession(activity, cast, async () => ATTRS);
    await flush();
    expect(ops).toEqual([["join", "settlewood", undefined]]);
  });

  it("a cast that ended before its art was ready starts nothing", async () => {
    const { activity, ops } = fakeActivity();
    const cast = fakeCast();
    let release: () => void = () => {};
    followCastSession(
      activity,
      cast,
      () =>
        new Promise((resolve) => {
          release = () => resolve(ATTRS);
        }),
    );
    cast.set("connected");
    cast.set("disconnected");
    release();
    await flush();
    expect(ops).toEqual([["end"]]);
  });
});

const casting = (label: string | null, appId = "rocket-crew"): SessionState => ({
  ...initialSession("s1", "mom"),
  cast: true,
  ...(label === null
    ? {}
    : {
        screen: "game" as const,
        current: {
          appId,
          instanceId: "i",
          mode: "new" as const,
          roster: [],
          label,
          startedAt: 1,
          viewUrl: null,
          hostDeviceId: null,
        },
      }),
});

function fakeCouch(initial: SessionState | null = null) {
  let state = initial;
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
    size: () => listeners.size,
  };
}

const attrsFor = async (appId: string) => ({ ...ATTRS, appId });
const PLAYING = (status: string) => ({ phase: "playing", status, yourTurn: false });

describe("followCouch (the OGS app)", () => {
  it("joins the game on the TV, updates on label changes only, ends with the cast", async () => {
    const { activity, ops } = fakeActivity();
    const couch = fakeCouch();
    const off = followCouch(activity, couch, attrsFor);
    couch.set(casting(null));
    couch.set(casting(""));
    await flush();
    expect(ops).toEqual([["join", "rocket-crew", PLAYING("Playing on the TV")]]);
    couch.set(casting("Mission 6"));
    couch.set({ ...casting("Mission 6"), members: [{ profileId: "k", name: "K", sticker: "s" }] });
    expect(ops.slice(1)).toEqual([["report", PLAYING("Mission 6")]]);
    couch.set({ ...casting("Mission 6"), cast: false });
    expect(ops.slice(2)).toEqual([["end"]]);
    off();
    expect(couch.size()).toBe(0);
  });

  it("a different game on the TV joins that game", async () => {
    const { activity, ops } = fakeActivity();
    const couch = fakeCouch(casting("Round 1"));
    followCouch(activity, couch, attrsFor);
    await flush();
    couch.set(casting("Page 1", "story-nook"));
    await flush();
    expect(ops.map((o) => o.slice(0, 2))).toEqual([
      ["join", "rocket-crew"],
      ["join", "story-nook"],
    ]);
  });

  it("leaving the couch ends the activity; leaving with nothing on ends nothing", async () => {
    const { activity, ops } = fakeActivity();
    const couch = fakeCouch(casting("Round 1"));
    followCouch(activity, couch, attrsFor);
    await flush();
    couch.set(null);
    couch.set(null);
    couch.set(casting(null));
    couch.set(null);
    expect(ops.map((o) => o[0])).toEqual(["join", "end"]);
  });

  it("an unknown game (no attributes) starts nothing, and a stale lookup never joins", async () => {
    const { activity, ops } = fakeActivity();
    const couch = fakeCouch();
    followCouch(activity, couch, async () => null);
    couch.set(casting("Round 1"));
    await flush();
    expect(ops).toEqual([]);

    const second = fakeActivity();
    let release: () => void = () => {};
    const couch2 = fakeCouch();
    followCouch(
      second.activity,
      couch2,
      (appId) =>
        new Promise((resolve) => {
          release = () => resolve({ ...ATTRS, appId });
        }),
    );
    couch2.set(casting("Round 1"));
    couch2.set({ ...casting("Round 1"), cast: false });
    release();
    await flush();
    expect(second.ops).toEqual([["end"]]);
  });
});

describe("registerPushTokens", () => {
  it("posts the token for the current couch session with the APNs environment", async () => {
    const post = jest.fn(async () => ({}));
    const onToken = registerPushTokens({
      sessionId: () => "s1",
      app: "ogs",
      environment: async () => "sandbox",
      post,
    });
    onToken({ activityId: "act-1", pushToken: "abcd" });
    await flush();
    expect(post).toHaveBeenCalledWith("s1", {
      activityId: "act-1",
      pushToken: "abcd",
      app: "ogs",
      environment: "sandbox",
    });
  });

  it("sends nothing without a session, and only warns when OGS refuses", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const post = jest.fn(async () => Promise.reject(new Error("404")));
    registerPushTokens({
      sessionId: () => null,
      app: "ogs",
      environment: async () => "production",
      post,
    })({
      activityId: "a",
      pushToken: "b",
    });
    await flush();
    expect(post).not.toHaveBeenCalled();
    registerPushTokens({
      sessionId: () => "s1",
      app: "ogs",
      environment: async () => "production",
      post,
    })({
      activityId: "a",
      pushToken: "b",
    });
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
