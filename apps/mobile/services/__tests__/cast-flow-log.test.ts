jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import { castToTv, endForTonight, endSessionAndWait, switchTv } from "../cast-flow";
import { createCastStore } from "../cast-store";
import type { SessionManagerLike } from "../cast-sync";
import { createCastTrace } from "../cast-trace";
import { type ClientLog, type EventFields, hashId } from "../client-log";
import { readConfig } from "../config";
import { createFakeCastBackend, FAKE_TV, FAKE_TV_2 } from "../fake-cast";

/** The cast lifecycle's wide events: what the owner's real-phone logs will show. */

type Logged = { name: string } & EventFields;

function recorder() {
  const events: Logged[] = [];
  const log: ClientLog = {
    event: (name, fields = {}) => void events.push({ name, ...fields }),
    flush: async () => {},
    background: async () => {},
    restore: async () => {},
  };
  let clock = 0;
  const trace = createCastTrace(log, () => (clock += 10));
  return { events, trace, names: () => events.map((e) => e.name) };
}

function setup(sm?: Partial<SessionManagerLike>) {
  const backend = createFakeCastBackend({
    mode: "two",
    loadUrl: "http://tv.test/load",
    fetch: async () => new Response("{}"),
  });
  const sessionManager = { ...backend.sessionManager, ...sm };
  const castStore = createCastStore();
  const r = recorder();
  const base = {
    api: { launcherToken: async () => "launch-1" },
    config: readConfig({}),
    castStore,
    backend: { sessionManager },
    trace: r.trace,
  };
  return { ...r, base, sessionManager, castStore };
}

describe("cast lifecycle log", () => {
  it("a cast: requested, start requested, start resolved (with the TV hashed), one attempt id", async () => {
    const t = setup();
    await castToTv({ ...t.base, deviceId: FAKE_TV.id });
    expect(t.names()).toEqual([
      "cast.cast.requested",
      "cast.start.requested",
      "cast.start.resolved",
    ]);
    const ids = new Set(t.events.map((e) => e.attemptId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toEqual(expect.any(String));
    expect(t.events[2]).toMatchObject({
      level: "info",
      durationMs: 10,
      data: { tv: hashId(FAKE_TV.id), started: true },
    });
    expect(JSON.stringify(t.events)).not.toContain(FAKE_TV.id);
  });

  it("a refused start is logged as a warning (started: false), not swallowed", async () => {
    const t = setup({ startSession: async () => false });
    await expect(castToTv({ ...t.base, deviceId: FAKE_TV.id })).resolves.toBe("no-tv");
    expect(t.events[2]).toMatchObject({
      name: "cast.start.resolved",
      level: "warn",
      data: { started: false },
    });
  });

  it("a start that throws is logged with its message, and is still no-TV", async () => {
    const t = setup({
      startSession: async () => {
        throw new Error("Device not found");
      },
    });
    await expect(castToTv({ ...t.base, deviceId: FAKE_TV.id })).resolves.toBe("no-tv");
    expect(t.events[2]).toMatchObject({ name: "cast.start.rejected", error: expect.any(Error) });
    expect((t.events[2].error as Error).message).toBe("Device not found");
  });

  it("a switch: the old session's end is asked for and waited for, then the new start, then done", async () => {
    const t = setup();
    await castToTv({ ...t.base, deviceId: FAKE_TV.id });
    t.castStore.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: FAKE_TV.id,
      deviceName: FAKE_TV.name,
      sessionId: "s",
      streamSessionId: "",
    });
    t.events.length = 0;
    await switchTv({ ...t.base, deviceId: FAKE_TV_2.id });
    expect(t.names()).toEqual([
      "cast.switch.requested",
      "cast.end.requested",
      "cast.end.waited",
      "cast.end.resolved",
      "cast.start.requested",
      "cast.start.resolved",
      "cast.switch.done",
    ]);
    expect(t.events[0].data).toEqual({ from: hashId(FAKE_TV.id), to: hashId(FAKE_TV_2.id) });
    expect(t.events[2].data).toEqual({ outcome: "ended" });
    expect(t.events[6]).toMatchObject({ level: "info", data: { result: "started" } });
    expect(new Set(t.events.map((e) => e.attemptId)).size).toBe(1);
  });

  it("a switch that can't start is an error event (the owner's 'sometimes it doesn't work')", async () => {
    const t = setup({ startSession: async () => false });
    await switchTv({ ...t.base, deviceId: FAKE_TV_2.id });
    expect(t.events.at(-1)).toMatchObject({
      name: "cast.switch.done",
      level: "error",
      data: { result: "no-tv" },
    });
  });

  it("an end that rejects is logged and the switch goes on (as before)", async () => {
    const t = setup({
      endCurrentSession: async () => {
        throw new Error("no session");
      },
    });
    await expect(switchTv({ ...t.base, deviceId: FAKE_TV_2.id })).resolves.toBe("started");
    expect(t.events.find((e) => e.name === "cast.end.rejected")).toMatchObject({
      error: expect.any(Error),
    });
  });

  it("Stop casting: stop requested, end resolved (or rejected) under one attempt", async () => {
    const t = setup();
    await endForTonight({ send: () => {}, sessionManager: t.sessionManager, trace: t.trace });
    expect(t.names()).toEqual(["cast.stop.requested", "cast.end.resolved"]);
    const failing = setup({
      endCurrentSession: async () => {
        throw new Error("x");
      },
    });
    await endForTonight({
      send: () => {},
      sessionManager: failing.sessionManager,
      trace: failing.trace,
    });
    expect(failing.names()).toEqual(["cast.stop.requested", "cast.end.rejected"]);
  });
});

describe("endSessionAndWait", () => {
  it("no session: asks for the end anyway (harmless) and doesn't wait", async () => {
    const end = jest.fn(async (_stop?: boolean) => {});
    const t = setup({ endCurrentSession: end });
    await expect(endSessionAndWait(t.sessionManager, { trace: t.trace })).resolves.toBe("none");
    expect(end).toHaveBeenCalledWith(true);
    expect(t.events[0]).toMatchObject({ name: "cast.end.requested", data: { hadSession: false } });
  });

  it("waits for the ended event, which may come well after endCurrentSession resolved", async () => {
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://tv.test/load",
      fetch: async () => new Response("{}"),
      endedAfterMs: 30,
    });
    const sm = backend.sessionManager;
    await sm.startSession(FAKE_TV.id);
    const ended = jest.fn();
    sm.onSessionEnded(ended);
    await expect(endSessionAndWait(sm)).resolves.toBe("ended");
    expect(ended).toHaveBeenCalledTimes(1);
    await expect(sm.startSession(FAKE_TV.id)).resolves.toBe(true);
  });

  it("gives up after the timeout (a warning) when no ended event comes", async () => {
    const t = setup({
      getCurrentCastSession: async () => ({
        getCastDevice: async () => null,
        addChannel: async () => ({ sendMessage: async () => {}, onMessage: () => {} }),
      }),
      endCurrentSession: async () => {},
    });
    await expect(
      endSessionAndWait(t.sessionManager, { timeoutMs: 20, trace: t.trace }),
    ).resolves.toBe("timeout");
    expect(t.events.find((e) => e.name === "cast.end.waited")).toMatchObject({
      level: "warn",
      data: { outcome: "timeout" },
    });
  });
});
