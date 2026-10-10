jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import { castToTv } from "../cast-flow";
import { createCastOnce } from "../cast-once";
import { createCastStore } from "../cast-store";
import { castCommands, type SessionManagerLike, startCastSync } from "../cast-sync";
import { createCastTrace } from "../cast-trace";
import { type ClientLog, type EventFields, hashId } from "../client-log";
import { readConfig } from "../config";
import { createFakeCastBackend, FAKE_TV, FAKE_TV_2 } from "../fake-cast";

/**
 * Cast (the TV tab, the cast prompt) when a Cast session is already up or on its way: Google
 * Cast's startSession answers NO "if there is a session currently established" (docs/lessons.md),
 * which the app used to show as "didn't answer" (owner, 2026-10-10: attempts 21cf-6, 24fr-7,
 * t8ol-8, each refused in 12-15 ms while a session was up). Cast looks at the session first.
 */

type Logged = { name: string } & EventFields;

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

function setup(opts: { endedAfterMs?: number; sm?: Partial<SessionManagerLike> } = {}) {
  const loads: { url: string; viewUrl: string }[] = [];
  const backend = createFakeCastBackend({
    mode: "two",
    loadUrl: "http://tv1.test/load",
    loadUrls: { [FAKE_TV_2.id]: "http://tv2.test/load" },
    fetch: async (url, init) => {
      if (url.endsWith("/load"))
        loads.push({ url, viewUrl: JSON.parse(String(init?.body)).viewUrl });
      return new Response("{}");
    },
    // Real Google Cast: a start is refused while a session is up (connected or ending).
    refuseWhileActive: true,
    endedAfterMs: opts.endedAfterMs,
  });
  const starts: string[] = [];
  const ends: string[] = [];
  const base = backend.sessionManager;
  const sessionManager: SessionManagerLike = {
    ...base,
    startSession: (id) => {
      starts.push(id);
      return base.startSession(id);
    },
    endCurrentSession: (stop) => {
      ends.push(String(stop));
      return base.endCurrentSession(stop);
    },
    ...opts.sm,
  };
  const castStore = createCastStore();
  startCastSync(castStore, sessionManager, castCommands(), "https://stream.test");
  const events: Logged[] = [];
  const log: ClientLog = {
    event: (name, fields = {}) => void events.push({ name, ...fields }),
    flush: async () => {},
    background: async () => {},
    restore: async () => {},
  };
  const trace = createCastTrace(log);
  let n = 0;
  const input = {
    api: { launcherToken: jest.fn(async () => `launch-${++n}`) },
    config: readConfig({}),
    castStore,
    backend: { sessionManager },
    trace,
  };
  const named = (name: string) => events.filter((e) => e.name === name);
  return { base, input, castStore, starts, ends, loads, events, named };
}

/** Casts the launcher to `tv` the way it was before this attempt, then clears the records. */
async function castBefore(t: ReturnType<typeof setup>, tv = FAKE_TV.id) {
  await castToTv({ ...t.input, deviceId: tv });
  await flush();
  expect(t.castStore.getSnapshot().session).toMatchObject({ status: "connected", deviceId: tv });
  t.starts.length = 0;
  t.ends.length = 0;
  t.loads.length = 0;
  t.events.length = 0;
}

describe("Cast while a Cast session is already up (the owner's 'didn't answer', 2026-10-10)", () => {
  it("the same TV already connected: no start, the cast is started, the new launcher goes to that TV", async () => {
    const t = setup();
    await castBefore(t);
    await expect(castToTv({ ...t.input, deviceId: FAKE_TV.id })).resolves.toBe("started");
    await flush();
    expect(t.starts).toEqual([]);
    expect(t.ends).toEqual([]);
    expect(t.loads).toEqual([
      { url: "http://tv1.test/load", viewUrl: expect.stringContaining("token=launch-2") },
    ]);
    expect(t.named("cast.start.skipped")[0]).toMatchObject({
      data: { reason: "already-connected" },
    });
  });

  it("the same TV still connecting (or resuming): no start; started once it connects", async () => {
    const t = setup();
    t.castStore.dispatch({ type: "START_CASTING", deviceId: FAKE_TV.id });
    const result = castToTv({ ...t.input, deviceId: FAKE_TV.id, connectWaitMs: 1000 });
    await flush();
    t.castStore.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: FAKE_TV.id,
      deviceName: FAKE_TV.name,
      sessionId: "s",
      streamSessionId: "",
    });
    await expect(result).resolves.toBe("started");
    expect(t.starts).toEqual([]);
    expect(t.named("cast.start.skipped")[0]).toMatchObject({ data: { reason: "connecting" } });
    expect(t.named("cast.connect.waited")[0]).toMatchObject({
      level: "info",
      data: { outcome: "connected" },
    });
  });

  it("the same TV connecting that never connects: a real timeout, logged as one", async () => {
    const t = setup();
    t.castStore.dispatch({ type: "START_CASTING", deviceId: FAKE_TV.id });
    await expect(castToTv({ ...t.input, deviceId: FAKE_TV.id, connectWaitMs: 20 })).resolves.toBe(
      "timeout",
    );
    expect(t.starts).toEqual([]);
    expect(t.named("cast.connect.waited")[0]).toMatchObject({
      level: "warn",
      data: { outcome: "timeout" },
    });
  });

  it("a session resuming that the store hasn't seen yet (only the SDK has it): waits, no start", async () => {
    const t = setup();
    await t.base.startSession(FAKE_TV.id);
    await flush();
    // The SDK has the session; the store hears of it only when cast-sync's lookup lands.
    t.castStore.dispatch({ type: "SESSION_ENDED" });
    const result = castToTv({ ...t.input, deviceId: FAKE_TV.id, connectWaitMs: 1000 });
    await flush();
    t.castStore.dispatch({
      type: "SESSION_CONNECTED",
      deviceId: FAKE_TV.id,
      deviceName: FAKE_TV.name,
      sessionId: "s",
      streamSessionId: "",
    });
    await expect(result).resolves.toBe("started");
    expect(t.starts).toEqual([]);
    expect(t.named("cast.start.requested")[0]).toMatchObject({
      data: { sessionStatus: "disconnected", sdkSession: true, currentTv: hashId(FAKE_TV.id) },
    });
  });

  it("another TV connected: the switch path (end, wait for ended, then start), not a raw start", async () => {
    const t = setup({ endedAfterMs: 30 });
    await castBefore(t, FAKE_TV.id);
    await expect(castToTv({ ...t.input, deviceId: FAKE_TV_2.id })).resolves.toBe("started");
    await flush();
    expect(t.ends).toEqual(["true"]);
    expect(t.starts).toEqual([FAKE_TV_2.id]);
    expect(t.castStore.getSnapshot().session).toMatchObject({
      status: "connected",
      deviceId: FAKE_TV_2.id,
    });
    expect(t.named("cast.end.waited")[0]).toMatchObject({ data: { outcome: "ended" } });
    expect(t.named("cast.start.resolved")[0]).toMatchObject({ data: { started: true } });
    // The new launcher went to the new TV only.
    expect(t.loads.map((l) => l.url)).toEqual(["http://tv2.test/load"]);
  });

  it("start.requested says what the phone knew: the session's status, the TV it is on, the target", async () => {
    const t = setup({ endedAfterMs: 0 });
    await castBefore(t, FAKE_TV.id);
    await castToTv({ ...t.input, deviceId: FAKE_TV_2.id });
    const [requested] = t.named("cast.start.requested");
    expect(requested.data).toMatchObject({
      sessionStatus: "connected",
      currentTv: hashId(FAKE_TV.id),
      targetTv: hashId(FAKE_TV_2.id),
      plan: "switch",
    });
    expect(JSON.stringify(t.events)).not.toContain(FAKE_TV.id);
  });

  it("no session and the SDK says no: a real failure (no-tv), the reason logged", async () => {
    const t = setup({ sm: { startSession: async () => false } });
    await expect(castToTv({ ...t.input, deviceId: FAKE_TV.id })).resolves.toBe("no-tv");
    expect(t.named("cast.start.resolved")[0]).toMatchObject({
      level: "warn",
      data: { started: false, reason: "refused-no-session" },
    });
  });

  it("the SDK says no because a session it knows of is up on another TV: refused-session-active, not no-tv", async () => {
    const t = setup();
    await t.base.startSession(FAKE_TV_2.id);
    await flush();
    t.castStore.dispatch({ type: "SESSION_ENDED" });
    // The SDK's session lookup only finds it after the refusal (a session coming up meanwhile).
    let lookups = 0;
    const sm = t.input.backend.sessionManager;
    const sessionManager: SessionManagerLike = {
      ...sm,
      getCurrentCastSession: () =>
        lookups++ === 0 ? Promise.resolve(null) : t.base.getCurrentCastSession(),
    };
    await expect(
      castToTv({ ...t.input, backend: { sessionManager }, deviceId: FAKE_TV.id }),
    ).resolves.toBe("refused-session-active");
    expect(t.named("cast.start.resolved")[0]).toMatchObject({
      data: { started: false, reason: "refused-session-active" },
    });
  });

  it("the SDK says no because the same TV's session came up meanwhile: waits for it, started", async () => {
    const t = setup();
    let lookups = 0;
    const sm = t.input.backend.sessionManager;
    const sessionManager: SessionManagerLike = {
      ...sm,
      getCurrentCastSession: () =>
        lookups++ === 0 ? Promise.resolve(null) : t.base.getCurrentCastSession(),
      startSession: async () => {
        // Someone else (the Cast dialog, a resume) started it a moment before.
        await t.base.startSession(FAKE_TV.id);
        return false;
      },
    };
    await expect(
      castToTv({
        ...t.input,
        backend: { sessionManager },
        deviceId: FAKE_TV.id,
        connectWaitMs: 1000,
      }),
    ).resolves.toBe("started");
    expect(t.named("cast.start.resolved")[0]).toMatchObject({
      data: { started: false, reason: "refused-session-active" },
    });
  });
});

describe("createCastOnce: one cast at a time", () => {
  it("overlapping taps share the cast in progress: one start", async () => {
    const t = setup();
    const once = createCastOnce();
    const cast = () => once.run(() => castToTv({ ...t.input, deviceId: FAKE_TV.id }));
    const [a, b] = await Promise.all([cast(), cast()]);
    expect([a, b]).toEqual(["started", "started"]);
    expect(t.starts).toEqual([FAKE_TV.id]);
    expect(t.input.api.launcherToken).toHaveBeenCalledTimes(1);
  });

  it("a tap after the cast finished casts again", async () => {
    const once = createCastOnce();
    const run = jest.fn(async () => "no-tv" as const);
    await once.run(run);
    await once.run(run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("a cast that throws lets the next one run", async () => {
    const once = createCastOnce();
    await expect(
      once.run(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    await expect(once.run(async () => "started" as const)).resolves.toBe("started");
  });
});
