import type { LiveActivityContent } from "@open-game-system/ogs-protocol";
import {
  createLiveActivity,
  GAME_OVER,
  LIVE_ACTIVITY_ENDED_SHOWN_MS,
  LIVE_ACTIVITY_THROTTLE_MS,
} from "../live-activity";
import type { ActivityState, LiveActivityNative } from "../live-activity-native";

/** The controller's edges: what counts as a change, failures, and starts that race their end. */
const T0 = 1_760_000_000_000;
const ATTRS = { appId: "rocket-crew", gameName: "Rocket Crew", deepLink: "x://live-activity/rc" };
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function native(overrides: Partial<LiveActivityNative> = {}) {
  const calls: [string, string, LiveActivityContent, number][] = [];
  let state: ((e: { activityId: string; state: ActivityState }) => void) | null = null;
  let token: ((e: { activityId: string; token: string }) => void) | null = null;
  const n: LiveActivityNative = {
    isEnabled: () => true,
    start: async () => "act-1",
    update: async (id, content, at) => {
      calls.push(["update", id, content, at]);
    },
    end: async (id, content, at) => {
      calls.push(["end", id, content, at]);
    },
    prepareArt: async () => null,
    onPushToken: (l) => {
      token = l;
      return () => {};
    },
    onStateChange: (l) => {
      state = l;
      return () => {};
    },
    ...overrides,
  };
  return {
    n,
    calls,
    state: (activityId: string, s: ActivityState) => state?.({ activityId, state: s }),
    token: (activityId: string, t: string) => token?.({ activityId, token: t }),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const PLAY = { phase: "playing" as const, status: "Round 3", yourTurn: false };

describe("what counts as a change", () => {
  it.each([
    ["the phase", { ...PLAY, phase: "waiting" as const }],
    ["whose turn", { ...PLAY, yourTurn: true }],
    ["the status", { ...PLAY, status: "Round 4" }],
  ])("%s alone is sent", async (_label, next) => {
    const { n, calls } = native();
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS, PLAY);
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS);
    activity.report(next);
    await flush();
    expect(calls.map((c) => c[2])).toEqual([
      { ...next, updatedAt: T0 + LIVE_ACTIVITY_THROTTLE_MS },
    ]);
  });

  it("Game over is the ended phase, nobody's turn", () => {
    expect(GAME_OVER).toEqual({ phase: "ended", status: "Game over", yourTurn: false });
  });

  it("an ended activity stays on the lock screen two minutes", async () => {
    const { n, calls } = native();
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS);
    await flush();
    activity.end();
    expect(calls[0]?.[3]).toBe(T0 + 120_000);
    expect(LIVE_ACTIVITY_ENDED_SHOWN_MS).toBe(120_000);
  });
});

describe("failures are logged, never thrown", () => {
  it.each([
    ["start", { start: () => Promise.reject(new Error("no")) }],
    ["update", { update: () => Promise.reject(new Error("no")) }],
    ["end", { end: () => Promise.reject(new Error("no")) }],
  ])("a refused %s", async (what, overrides) => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { n } = native(overrides);
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS, PLAY);
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS);
    activity.report({ ...PLAY, status: "Round 4" });
    await flush();
    activity.end();
    await flush();
    expect(warn).toHaveBeenCalledWith(
      `[ogs-shell] Live Activity ${what} failed:`,
      expect.any(Error),
    );
  });

  it("a refused start of a game that was already replaced leaves the new one running", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    let rejectFirst: (e: Error) => void = () => {};
    let n = 0;
    const { n: mod } = native({
      start: () => {
        n++;
        return n === 1
          ? new Promise<string>((_, reject) => {
              rejectFirst = reject;
            })
          : Promise.resolve("act-2");
      },
    });
    const activity = createLiveActivity({ native: mod, now: Date.now });
    activity.join(ATTRS);
    activity.join({ ...ATTRS, appId: "story-nook" });
    await flush();
    rejectFirst(new Error("no"));
    await flush();
    expect(activity.current()).toEqual({ id: "act-2", appId: "story-nook" });
  });
});

describe("starts that race", () => {
  it("a start that resolves after its game was replaced is ended at once (Game over, no linger)", async () => {
    let resolveFirst: (id: string) => void = () => {};
    let count = 0;
    const { n, calls } = native({
      start: () => {
        count++;
        return count === 1
          ? new Promise<string>((resolve) => {
              resolveFirst = resolve;
            })
          : Promise.resolve("act-2");
      },
    });
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS);
    activity.join({ ...ATTRS, appId: "story-nook" });
    await flush();
    resolveFirst("act-1");
    await flush();
    expect(calls).toEqual([["end", "act-1", { ...GAME_OVER, updatedAt: T0 }, T0]]);
    expect(activity.current()).toEqual({ id: "act-2", appId: "story-nook" });
  });

  it("a token for another activity while one is starting doesn't reach the running one later", async () => {
    let resolveStart: (id: string) => void = () => {};
    const { n, token } = native({
      start: () =>
        new Promise<string>((resolve) => {
          resolveStart = resolve;
        }),
    });
    const tokens: unknown[] = [];
    const activity = createLiveActivity({
      native: n,
      now: Date.now,
      onPushToken: (t) => tokens.push(t),
    });
    token("act-0", "aaaa");
    activity.join(ATTRS);
    resolveStart("act-1");
    await flush();
    token("act-1", "bbbb");
    expect(tokens).toEqual([{ activityId: "act-1", pushToken: "bbbb" }]);
  });

  it("works without a token listener", async () => {
    const { n, token } = native();
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS);
    await flush();
    expect(() => token("act-1", "abcd")).not.toThrow();
  });
});

describe("state changes", () => {
  it.each(["ended", "dismissed"] as const)("%s forgets the activity", async (s) => {
    const { n, calls, state } = native();
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS);
    await flush();
    state("act-1", s);
    expect(activity.current()).toBeNull();
    activity.end();
    expect(calls).toEqual([]);
  });

  it.each(["stale", "pending", "active"] as const)("%s keeps it", async (s) => {
    const { n, state } = native();
    const activity = createLiveActivity({ native: n, now: Date.now });
    activity.join(ATTRS);
    await flush();
    state("act-1", s);
    expect(activity.current()).not.toBeNull();
  });
});
