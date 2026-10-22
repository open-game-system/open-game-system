import type { LiveActivityAttributes, LiveActivityContent } from "@open-game-system/ogs-protocol";
import {
  createLiveActivity,
  LIVE_ACTIVITY_ENDED_SHOWN_MS,
  LIVE_ACTIVITY_IDLE_MS,
  LIVE_ACTIVITY_STALE_MS,
  LIVE_ACTIVITY_THROTTLE_MS,
} from "../live-activity";
import type { ActivityState, LiveActivityNative } from "../live-activity-native";

type Call =
  | {
      op: "start";
      attributes: LiveActivityAttributes;
      content: LiveActivityContent;
      staleAt: number;
    }
  | { op: "update"; id: string; content: LiveActivityContent; staleAt: number }
  | { op: "end"; id: string; content: LiveActivityContent; dismissAt: number };

function fakeNative(opts: { enabled?: boolean; failStart?: boolean } = {}) {
  const calls: Call[] = [];
  const tokenListeners = new Set<(e: { activityId: string; token: string }) => void>();
  const stateListeners = new Set<(e: { activityId: string; state: ActivityState }) => void>();
  let n = 0;
  const native: LiveActivityNative = {
    isEnabled: () => opts.enabled ?? true,
    async start(attributes, content, staleAt) {
      if (opts.failStart) throw new Error("ActivityKit said no");
      calls.push({ op: "start", attributes, content, staleAt });
      n++;
      return `act-${n}`;
    },
    async update(id, content, staleAt) {
      calls.push({ op: "update", id, content, staleAt });
    },
    async end(id, content, dismissAt) {
      calls.push({ op: "end", id, content, dismissAt });
    },
    async prepareArt() {
      return null;
    },
    onPushToken(listener) {
      tokenListeners.add(listener);
      return () => tokenListeners.delete(listener);
    },
    onStateChange(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
  };
  return {
    native,
    calls,
    pushToken: (activityId: string, token: string) => {
      for (const l of [...tokenListeners]) l({ activityId, token });
    },
    state: (activityId: string, state: ActivityState) => {
      for (const l of [...stateListeners]) l({ activityId, state });
    },
    listeners: () => tokenListeners.size + stateListeners.size,
  };
}

const T0 = 1_760_000_000_000;
const ATTRS: LiveActivityAttributes = {
  appId: "rocket-crew",
  gameName: "Rocket Crew",
  roomCode: "KXTE42",
  deepLink: "opengame://live-activity/rocket-crew",
};
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
});
afterEach(() => jest.useRealTimers());

function setup(opts: Parameters<typeof fakeNative>[0] = {}) {
  const fake = fakeNative(opts);
  const tokens: { activityId: string; pushToken: string }[] = [];
  const activity = createLiveActivity({
    native: fake.native,
    now: () => Date.now(),
    onPushToken: (t) => tokens.push(t),
  });
  return { ...fake, activity, tokens };
}

describe("start: the phone joins a game as its controller", () => {
  it("starts an activity with the game, a status, and a stale date 4 hours out", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS, { phase: "playing", status: "Playing on the TV", yourTurn: false });
    await flush();
    expect(calls).toEqual([
      {
        op: "start",
        attributes: ATTRS,
        content: { phase: "playing", status: "Playing on the TV", yourTurn: false, updatedAt: T0 },
        staleAt: T0 + LIVE_ACTIVITY_STALE_MS,
      },
    ]);
    expect(activity.current()).toEqual({ id: "act-1", appId: "rocket-crew" });
  });

  it("joining the same game again starts nothing new", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    activity.join(ATTRS);
    await flush();
    activity.join(ATTRS);
    await flush();
    expect(calls.filter((c) => c.op === "start")).toHaveLength(1);
  });

  it("another game ends the first activity and starts its own", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    activity.join({ ...ATTRS, appId: "story-nook", gameName: "Story Nook" });
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start", "end", "start"]);
    expect(activity.current()).toEqual({ id: "act-2", appId: "story-nook" });
  });

  it("does nothing at all when the user disallowed Live Activities", async () => {
    const { activity, calls } = setup({ enabled: false });
    activity.join(ATTRS);
    activity.report({ phase: "playing", status: "Round 3", yourTurn: false });
    activity.end();
    await flush();
    expect(calls).toEqual([]);
    expect(activity.current()).toBeNull();
  });

  it("a start ActivityKit refuses leaves no activity and throws nowhere", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { activity, calls } = setup({ failStart: true });
    activity.join(ATTRS);
    await flush();
    expect(activity.current()).toBeNull();
    activity.report({ phase: "playing", status: "Round 3", yourTurn: false });
    await flush();
    expect(calls).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("is a no-op without the native module (Android, Expo Go, the flag off)", async () => {
    const activity = createLiveActivity({ native: null, now: () => Date.now() });
    activity.join(ATTRS);
    activity.report({ phase: "playing", status: "Round 3", yourTurn: false });
    activity.end();
    await flush();
    expect(activity.current()).toBeNull();
  });
});

describe("update: meaningful changes, throttled", () => {
  it("sends a changed status at once when nothing went out recently", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS);
    activity.report({ phase: "playing", status: "Round 3 · Your turn", yourTurn: true });
    await flush();
    expect(calls[1]).toEqual({
      op: "update",
      id: "act-1",
      content: {
        phase: "playing",
        status: "Round 3 · Your turn",
        yourTurn: true,
        updatedAt: T0 + LIVE_ACTIVITY_THROTTLE_MS,
      },
      staleAt: T0 + LIVE_ACTIVITY_STALE_MS,
    });
  });

  it("coalesces a burst into the last status, sent when the throttle window ends", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    activity.report({ phase: "playing", status: "Round 1", yourTurn: false });
    activity.report({ phase: "playing", status: "Round 2", yourTurn: false });
    activity.report({ phase: "playing", status: "Round 3", yourTurn: false });
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start"]);
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS - 1);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start"]);
    jest.advanceTimersByTime(1);
    await flush();
    expect(calls.map((c) => (c.op === "update" ? c.content.status : c.op))).toEqual([
      "start",
      "Round 3",
    ]);
  });

  it("sends nothing for a report that changes nothing on the lock screen", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS, { phase: "lobby", status: "In lobby", yourTurn: false });
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS * 3);
    activity.report({ phase: "lobby", status: "In lobby", yourTurn: false });
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS * 3);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start"]);
  });

  it("a report before the start finished is the start's content", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    activity.report({ phase: "waiting", status: "Waiting for players", yourTurn: false });
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS);
    await flush();
    const statuses = calls.map((c) => c.content.status);
    expect(statuses[statuses.length - 1]).toBe("Waiting for players");
  });

  it("a report with no activity running starts nothing", async () => {
    const { activity, calls } = setup();
    activity.report({ phase: "playing", status: "Round 3", yourTurn: false });
    await flush();
    expect(calls).toEqual([]);
  });

  it("an ended report ends the activity showing it", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    activity.report({ phase: "ended", status: "Game over", yourTurn: false });
    await flush();
    expect(calls[1]).toEqual({
      op: "end",
      id: "act-1",
      content: { phase: "ended", status: "Game over", yourTurn: false, updatedAt: T0 },
      dismissAt: T0 + LIVE_ACTIVITY_ENDED_SHOWN_MS,
    });
    expect(activity.current()).toBeNull();
  });
});

describe("end: the session ends, or the activity goes idle or stale", () => {
  it("end() ends with Game over and drops a pending update", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    activity.report({ phase: "playing", status: "Round 9", yourTurn: false });
    activity.end();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS * 2);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start", "end"]);
    expect(calls[1]?.content.status).toBe("Game over");
  });

  it("end() while the start is still in flight ends it once it has an id", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    activity.end();
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start", "end"]);
    expect(activity.current()).toBeNull();
  });

  it("ends after 30 minutes with no report or join", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_IDLE_MS - 1000);
    activity.report({ phase: "playing", status: "Round 2", yourTurn: false });
    await flush();
    jest.advanceTimersByTime(LIVE_ACTIVITY_IDLE_MS - 1);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start", "update"]);
    jest.advanceTimersByTime(1);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start", "update", "end"]);
  });

  it("ends 4 hours after it started, however busy", async () => {
    const { activity, calls } = setup();
    activity.join(ATTRS);
    await flush();
    for (let t = 0; t < LIVE_ACTIVITY_STALE_MS; t += LIVE_ACTIVITY_IDLE_MS / 2) {
      jest.advanceTimersByTime(LIVE_ACTIVITY_IDLE_MS / 2);
      activity.report({ phase: "playing", status: `t${t}`, yourTurn: false });
      await flush();
    }
    expect(calls[calls.length - 1]?.op).toBe("end");
    expect(activity.current()).toBeNull();
  });

  it("forgets an activity the user dismissed: no more updates, and a new join starts again", async () => {
    const { activity, calls, state } = setup();
    activity.join(ATTRS);
    await flush();
    state("act-1", "dismissed");
    expect(activity.current()).toBeNull();
    jest.advanceTimersByTime(LIVE_ACTIVITY_THROTTLE_MS);
    activity.report({ phase: "playing", status: "Round 3", yourTurn: false });
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start"]);
    state("act-other", "dismissed");
    activity.join(ATTRS);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start", "start"]);
  });

  it("a still-active state change keeps the activity", async () => {
    const { activity, state } = setup();
    activity.join(ATTRS);
    await flush();
    state("act-1", "active");
    expect(activity.current()).toEqual({ id: "act-1", appId: "rocket-crew" });
  });
});

describe("push tokens (remote updates)", () => {
  it("hands on the current activity's token, and ignores others'", async () => {
    const { activity, pushToken, tokens } = setup();
    activity.join(ATTRS);
    await flush();
    pushToken("act-1", "abcd");
    pushToken("act-9", "ffff");
    expect(tokens).toEqual([{ activityId: "act-1", pushToken: "abcd" }]);
  });

  it("dispose ends listening and the timers", async () => {
    const { activity, listeners, calls } = setup();
    activity.join(ATTRS);
    await flush();
    activity.dispose();
    expect(listeners()).toBe(0);
    jest.advanceTimersByTime(LIVE_ACTIVITY_STALE_MS);
    await flush();
    expect(calls.map((c) => c.op)).toEqual(["start"]);
  });
});
