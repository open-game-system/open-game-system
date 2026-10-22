import { createLiveActivity } from "../live-activity";
import { liveActivityNativeFrom, loadLiveActivityNative } from "../live-activity-native";

/** A stand-in for the Swift module's JS object: records calls, emits events. */
function fakeModule(overrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  const mod = {
    areActivitiesEnabled: () => true,
    startActivity: async (...args: unknown[]) => {
      calls.push(["startActivity", ...args]);
      return "act-1";
    },
    updateActivity: async (...args: unknown[]) => {
      calls.push(["updateActivity", ...args]);
    },
    endActivity: async (...args: unknown[]) => {
      calls.push(["endActivity", ...args]);
    },
    prepareArt: async (url: string, name: string) => {
      calls.push(["prepareArt", url, name]);
      return name;
    },
    addListener(event: string, handler: (payload: unknown) => void) {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
      return { remove: () => set.delete(handler) };
    },
    ...overrides,
  };
  const emit = (event: string, payload: unknown) => {
    for (const h of [...(handlers.get(event) ?? [])]) h(payload);
  };
  const count = () => [...handlers.values()].reduce((n, s) => n + s.size, 0);
  return { mod, calls, emit, count };
}

const ATTRS = { appId: "rocket-crew", gameName: "Rocket Crew", deepLink: "x://live-activity/a" };
const CONTENT = { phase: "playing" as const, status: "Round 3", yourTurn: false, updatedAt: 1 };

describe("liveActivityNativeFrom: the Swift module, parsed", () => {
  it("is null for anything that isn't the module", () => {
    expect(liveActivityNativeFrom(null)).toBeNull();
    expect(liveActivityNativeFrom(undefined)).toBeNull();
    expect(liveActivityNativeFrom("OgsLiveActivity")).toBeNull();
    for (const missing of [
      "areActivitiesEnabled",
      "startActivity",
      "updateActivity",
      "endActivity",
      "prepareArt",
      "addListener",
    ])
      expect(liveActivityNativeFrom(fakeModule({ [missing]: undefined }).mod)).toBeNull();
  });

  it("is null in Jest, Expo Go and Android builds (no native module)", () => {
    expect(loadLiveActivityNative()).toBeNull();
  });

  it("passes attributes and content to Swift as JSON (Codable on the other side)", async () => {
    const { mod, calls } = fakeModule();
    const native = liveActivityNativeFrom(mod);
    expect(await native?.start(ATTRS, CONTENT, 99)).toBe("act-1");
    await native?.update("act-1", CONTENT, 99);
    await native?.end("act-1", CONTENT, 120);
    expect(calls).toEqual([
      ["startActivity", JSON.stringify(ATTRS), JSON.stringify(CONTENT), 99],
      ["updateActivity", "act-1", JSON.stringify(CONTENT), 99],
      ["endActivity", "act-1", JSON.stringify(CONTENT), 120],
    ]);
  });

  it("isEnabled is true only for a literal true", () => {
    expect(liveActivityNativeFrom(fakeModule().mod)?.isEnabled()).toBe(true);
    expect(
      liveActivityNativeFrom(fakeModule({ areActivitiesEnabled: () => "yes" }).mod)?.isEnabled(),
    ).toBe(false);
  });

  it("rejects a start whose id isn't a string", async () => {
    const native = liveActivityNativeFrom(fakeModule({ startActivity: async () => 42 }).mod);
    await expect(native?.start(ATTRS, CONTENT, 1)).rejects.toThrow();
  });

  it("prepareArt answers the saved name, or null for nothing usable", async () => {
    expect(
      await liveActivityNativeFrom(fakeModule().mod)?.prepareArt("https://a/b.webp", "rc.png"),
    ).toBe("rc.png");
    const failing = liveActivityNativeFrom(fakeModule({ prepareArt: async () => 7 }).mod);
    expect(await failing?.prepareArt("https://a/b.webp", "rc.png")).toBeNull();
    const none = liveActivityNativeFrom(fakeModule({ prepareArt: async () => null }).mod);
    expect(await none?.prepareArt("https://a/b.webp", "rc.png")).toBeNull();
  });

  it("parses each event and drops malformed ones", () => {
    const { mod, emit, count } = fakeModule();
    const native = liveActivityNativeFrom(mod);
    const got: unknown[] = [];
    const offs = [
      native?.onPushToken((e) => got.push(["token", e])),
      native?.onStateChange((e) => got.push(["state", e])),
      native?.onPushToStartToken?.((t) => got.push(["start-token", t])),
    ];
    emit("onPushToken", { activityId: "act-1", token: "abcd" });
    emit("onPushToken", { activityId: "act-1" });
    emit("onStateChange", { activityId: "act-1", state: "dismissed" });
    emit("onStateChange", { activityId: "act-1", state: "exploded" });
    emit("onPushToStartToken", { token: "beef" });
    emit("onPushToStartToken", "beef");
    expect(got).toEqual([
      ["token", { activityId: "act-1", token: "abcd" }],
      ["state", { activityId: "act-1", state: "dismissed" }],
      ["start-token", "beef"],
    ]);
    expect(count()).toBe(3);
    for (const off of offs) off?.();
    expect(count()).toBe(0);
  });

  it("an addListener without a removable subscription still unsubscribes harmlessly", () => {
    const native = liveActivityNativeFrom(fakeModule({ addListener: () => undefined }).mod);
    const off = native?.onPushToken(() => {});
    expect(() => off?.()).not.toThrow();
  });
});

describe("a token ActivityKit sends before the start resolves", () => {
  it("is handed on once the activity has its id", async () => {
    let resolveStart: (id: string) => void = () => {};
    const { mod, emit } = fakeModule({
      startActivity: () =>
        new Promise<string>((resolve) => {
          resolveStart = resolve;
        }),
    });
    const tokens: unknown[] = [];
    const activity = createLiveActivity({
      native: liveActivityNativeFrom(mod),
      now: () => 1,
      onPushToken: (t) => tokens.push(t),
    });
    activity.join(ATTRS);
    emit("onPushToken", { activityId: "act-7", token: "abcd" });
    expect(tokens).toEqual([]);
    resolveStart("act-7");
    await new Promise((r) => setTimeout(r, 0));
    expect(tokens).toEqual([{ activityId: "act-7", pushToken: "abcd" }]);
    activity.dispose();
  });

  it("is dropped when it isn't the activity that started", async () => {
    const { mod, emit } = fakeModule();
    const tokens: unknown[] = [];
    const activity = createLiveActivity({
      native: liveActivityNativeFrom(mod),
      now: () => 1,
      onPushToken: (t) => tokens.push(t),
    });
    emit("onPushToken", { activityId: "act-0", token: "abcd" });
    activity.join(ATTRS);
    emit("onPushToken", { activityId: "act-9", token: "ffff" });
    await new Promise((r) => setTimeout(r, 0));
    expect(tokens).toEqual([]);
    activity.dispose();
  });
});
