jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import { createCastStore } from "../cast-store";
import { castCommands, startCastSync } from "../cast-sync";
import {
  createFakeCastBackend,
  FAKE_TV,
  FAKE_TV_2,
  FAKE_TV_2_DELAY_MS,
  fakeCastOptions,
} from "../fake-cast";

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(mode: "one" | "two" | "none" = "one") {
  const posts: { url: string; body: unknown }[] = [];
  const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response("{}", { status: 200 });
  });
  const backend = createFakeCastBackend({
    mode,
    loadUrl: "http://fake.test/load",
    fetch: fetchImpl,
  });
  return { backend, posts };
}

describe("fake cast for the simulator (EXPO_PUBLIC_FAKE_CAST)", () => {
  it("=1 discovers one living room TV, named like a real one (owner: no '(simulated)')", async () => {
    const { backend } = setup();
    const seen = jest.fn();
    backend.subscribeDevices(seen);
    backend.startDiscovery();
    await flush();
    expect(backend.getDevices()).toEqual([FAKE_TV]);
    expect(FAKE_TV.name).toBe("Living room TV");
    expect(seen).toHaveBeenCalledWith([FAKE_TV]);
  });

  it("=2: the living room TV at once, a second TV a moment later (discovery trickles in)", () => {
    jest.useFakeTimers();
    try {
      const { backend } = setup("two");
      const seen = jest.fn();
      backend.subscribeDevices(seen);
      backend.startDiscovery();
      expect(backend.getDevices()).toEqual([FAKE_TV]);
      jest.advanceTimersByTime(FAKE_TV_2_DELAY_MS - 1);
      expect(backend.getDevices()).toEqual([FAKE_TV]);
      jest.advanceTimersByTime(1);
      expect(backend.getDevices()).toEqual([FAKE_TV, FAKE_TV_2]);
      expect(seen).toHaveBeenLastCalledWith([FAKE_TV, FAKE_TV_2]);
      expect(FAKE_TV_2.name).toBe("Bedroom TV");
    } finally {
      jest.useRealTimers();
    }
  });

  it("=2: a new search keeps the TVs already found (like Cast's known routes)", () => {
    jest.useFakeTimers();
    try {
      const { backend } = setup("two");
      backend.startDiscovery();
      jest.advanceTimersByTime(FAKE_TV_2_DELAY_MS);
      backend.startDiscovery();
      expect(backend.getDevices()).toEqual([FAKE_TV, FAKE_TV_2]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("=2: searching again while the second TV is on its way doesn't put it off", () => {
    jest.useFakeTimers();
    try {
      const { backend } = setup("two");
      backend.startDiscovery();
      jest.advanceTimersByTime(FAKE_TV_2_DELAY_MS - 500);
      backend.startDiscovery();
      jest.advanceTimersByTime(500);
      expect(backend.getDevices()).toEqual([FAKE_TV, FAKE_TV_2]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("=2: casting to the second TV names it in the session", async () => {
    const { backend } = setup("two");
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    await expect(backend.sessionManager.startSession(FAKE_TV_2.id)).resolves.toBe(true);
    await flush();
    await flush();
    expect(store.getSnapshot().session).toMatchObject({
      status: "connected",
      deviceName: "Bedroom TV",
    });
  });

  it("=none finds no TV at all", async () => {
    const { backend } = setup("none");
    backend.startDiscovery();
    await flush();
    expect(backend.getDevices()).toEqual([]);
    await expect(backend.sessionManager.startSession(FAKE_TV.id)).resolves.toBe(false);
  });

  it("starting a session loads the view by POSTing it to the fake Chromecast", async () => {
    const { backend, posts } = setup();
    const store = createCastStore();
    const commands = castCommands();
    startCastSync(store, backend.sessionManager, commands, "https://stream.test");
    store.dispatch({ type: "SET_VIEW_URL", url: "http://localhost:5180/?api=a&token=t" });
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await flush();
    expect(store.getSnapshot().session).toMatchObject({
      status: "connected",
      deviceName: "Living room TV",
    });
    expect(posts).toEqual([
      { url: "http://fake.test/load", body: { viewUrl: "http://localhost:5180/?api=a&token=t" } },
    ]);
  });

  it("an existing session is picked up when sync starts (app reopened while cast)", async () => {
    const { backend } = setup();
    await backend.sessionManager.startSession(FAKE_TV.id);
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    await flush();
    await flush();
    expect(store.getSnapshot().session.status).toBe("connected");
  });

  it("ending the session disconnects the store", async () => {
    const { backend } = setup();
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await backend.sessionManager.endCurrentSession(true);
    expect(store.getSnapshot().session.status).toBe("disconnected");
    await expect(backend.sessionManager.getCurrentCastSession()).resolves.toBeNull();
  });

  it("ending the session stops the fake Chromecast (POST /stop on its origin), like a real receiver closing", async () => {
    const calls: { url: string; method: string | undefined }[] = [];
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://fake.test:5181/load",
      fetch: async (url, init) => {
        calls.push({ url, method: init?.method });
        return new Response("{}");
      },
    });
    const ended = jest.fn();
    backend.sessionManager.onSessionEnded(ended);
    await backend.sessionManager.startSession(FAKE_TV.id);
    await backend.sessionManager.endCurrentSession(true);
    expect(calls).toEqual([{ url: "http://fake.test:5181/stop", method: "POST" }]);
    expect(ended).toHaveBeenCalledTimes(1);
    // Ending again (no session) posts nothing more.
    await backend.sessionManager.endCurrentSession(true);
    expect(calls).toHaveLength(1);
  });

  it("a stop the fake Chromecast can't take is logged, and the session still ends", async () => {
    const err = new TypeError("offline");
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://fake.test/load",
      fetch: async () => {
        throw err;
      },
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const ended = jest.fn();
    backend.sessionManager.onSessionEnded(ended);
    await backend.sessionManager.startSession(FAKE_TV.id);
    await expect(backend.sessionManager.endCurrentSession(true)).resolves.toBeUndefined();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[fake-cast] the fake Chromecast did not stop:", err);
    await expect(backend.sessionManager.getCurrentCastSession()).resolves.toBeNull();
    warn.mockRestore();
  });

  it("a load the fake Chromecast can't take is logged, not thrown", async () => {
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://fake.test/load",
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s");
    store.dispatch({ type: "SET_VIEW_URL", url: "http://x/" });
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await flush();
    expect(store.getSnapshot().session.status).toBe("connected");
    warn.mockRestore();
  });
});

describe("fake cast, the receiver channel", () => {
  async function channel(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://fake.test/load",
      fetch: fetchImpl,
    });
    await backend.sessionManager.startSession(FAKE_TV.id);
    const session = await backend.sessionManager.getCurrentCastSession();
    if (!session) throw new Error("no session");
    return session.addChannel("urn:x-cast:org.opengame.view");
  }
  const ok = () => jest.fn(async (_url: string, _init?: RequestInit) => new Response("{}"));

  it("is the simulated living room Chromecast", () => {
    expect(FAKE_TV).toEqual({
      id: "fake-living-room",
      name: "Living room TV",
      type: "chromecast",
    });
  });

  it("POSTs LOAD_VIEW as JSON, whether the message is an object or a string", async () => {
    const f = ok();
    const ch = await channel(f);
    await ch.sendMessage({ type: "LOAD_VIEW", viewUrl: "http://a/" });
    await ch.sendMessage(JSON.stringify({ type: "LOAD_VIEW", viewUrl: "http://b/" }));
    expect(f.mock.calls).toEqual([
      [
        "http://fake.test/load",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewUrl: "http://a/" }),
        },
      ],
      [
        "http://fake.test/load",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewUrl: "http://b/" }),
        },
      ],
    ]);
  });

  it("ignores every other message, including a JSON null", async () => {
    const f = ok();
    const ch = await channel(f);
    await ch.sendMessage({ type: "PING" });
    await expect(ch.sendMessage("null")).resolves.toBeUndefined();
    expect(f).not.toHaveBeenCalled();
  });

  it("logs a load the fake Chromecast can't take", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const err = new TypeError("offline");
    const ch = await channel(async () => {
      throw err;
    });
    await ch.sendMessage({ type: "LOAD_VIEW", viewUrl: "http://a/" });
    expect(warn).toHaveBeenCalledWith(
      "[fake-cast] the fake Chromecast did not take the view:",
      err,
    );
    warn.mockRestore();
  });
});

describe("fake cast, the session manager", () => {
  it("finds no devices before discovery, and stops telling a listener that unsubscribed", () => {
    const backend = createFakeCastBackend({ mode: "one", loadUrl: "x", fetch: jest.fn() });
    expect(backend.getDevices()).toEqual([]);
    const seen = jest.fn();
    const off = backend.subscribeDevices(seen);
    off();
    backend.startDiscovery();
    expect(seen).not.toHaveBeenCalled();
    expect(() => backend.showCastDialog()).not.toThrow();
  });

  it("starts on the fake TV, tells listeners, and lets them unsubscribe", async () => {
    const { sessionManager: sm } = createFakeCastBackend({
      mode: "one",
      loadUrl: "x",
      fetch: jest.fn(),
    });
    const starting = jest.fn();
    const started = jest.fn();
    const ended = jest.fn();
    sm.onSessionStarting(starting);
    sm.onSessionStarted(started);
    const endSub = sm.onSessionEnded(ended);
    await expect(sm.startSession(FAKE_TV.id)).resolves.toBe(true);
    expect(starting).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledTimes(1);
    const session = await sm.getCurrentCastSession();
    await expect(session?.getCastDevice()).resolves.toEqual({
      deviceId: "fake-living-room",
      friendlyName: "Living room TV",
    });
    endSub.remove();
    await sm.endCurrentSession(true);
    expect(ended).not.toHaveBeenCalled();
  });

  it("ending with no session is a no-op", async () => {
    const { sessionManager: sm } = createFakeCastBackend({
      mode: "one",
      loadUrl: "x",
      fetch: jest.fn(),
    });
    const ended = jest.fn();
    sm.onSessionEnded(ended);
    await sm.endCurrentSession(true);
    expect(ended).not.toHaveBeenCalled();
  });

  it("gives every lifecycle hook a removable subscription (the fake never fires the rest)", () => {
    const { sessionManager: sm } = createFakeCastBackend({
      mode: "one",
      loadUrl: "x",
      fetch: jest.fn(),
    });
    for (const sub of [
      sm.onSessionStarting(() => {}),
      sm.onSessionStartFailed(() => {}),
      sm.onSessionSuspended(() => {}),
      sm.onSessionResumed(() => {}),
    ]) {
      expect(() => sub.remove()).not.toThrow();
    }
  });
});

describe("fake cast, real Google Cast timing (endedAfterMs)", () => {
  /** Two fake Chromecasts, each on its own origin, like two real TVs. */
  function twoTvs(endedAfterMs = 30) {
    const calls: string[] = [];
    const backend = createFakeCastBackend({
      mode: "two",
      loadUrl: "http://tv1.test/load",
      loadUrls: { [FAKE_TV_2.id]: "http://tv2.test/load" },
      fetch: async (url) => {
        calls.push(url);
        return new Response("{}");
      },
      endedAfterMs,
    });
    const events: string[] = [];
    const sm = backend.sessionManager;
    sm.onSessionStarting(() => events.push("starting"));
    sm.onSessionStarted(() => events.push("started"));
    sm.onSessionEnding?.(() => events.push("ending"));
    sm.onSessionEnded(() => events.push("ended"));
    return { backend, sm, calls, events };
  }
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("endCurrentSession resolves on request (like the native bridge); ended comes later", async () => {
    const t = twoTvs();
    await t.sm.startSession(FAKE_TV.id);
    await t.sm.endCurrentSession(true);
    expect(t.events).toEqual(["starting", "started", "ending"]);
    await wait(60);
    expect(t.events).toEqual(["starting", "started", "ending", "ended"]);
    await expect(t.sm.getCurrentCastSession()).resolves.toBeNull();
  });

  it("refuses a start while a session is ending (GCK: NO while a session is established)", async () => {
    const t = twoTvs();
    await t.sm.startSession(FAKE_TV.id);
    await t.sm.endCurrentSession(true);
    await expect(t.sm.startSession(FAKE_TV_2.id)).resolves.toBe(false);
    await wait(60);
    await expect(t.sm.startSession(FAKE_TV_2.id)).resolves.toBe(true);
  });

  it("refuses a start while a session is connected", async () => {
    const t = twoTvs();
    await t.sm.startSession(FAKE_TV.id);
    await expect(t.sm.startSession(FAKE_TV_2.id)).resolves.toBe(false);
    expect(t.events).toEqual(["starting", "started"]);
  });

  it("the session is still current while it ends", async () => {
    const t = twoTvs();
    await t.sm.startSession(FAKE_TV.id);
    await t.sm.endCurrentSession(true);
    await expect(t.sm.getCurrentCastSession()).resolves.not.toBeNull();
  });

  it("each TV has its own fake Chromecast: LOAD_VIEW and /stop go to that TV's origin", async () => {
    const t = twoTvs(0);
    await t.sm.startSession(FAKE_TV_2.id);
    const session = await t.sm.getCurrentCastSession();
    const ch = await session?.addChannel("urn:x-cast:org.opengame.view");
    await ch?.sendMessage({ type: "LOAD_VIEW", viewUrl: "http://a/" });
    await t.sm.endCurrentSession(true);
    await wait(10);
    expect(t.calls).toEqual(["http://tv2.test/load", "http://tv2.test/stop"]);
  });

  it("ending twice while ending ends once", async () => {
    const t = twoTvs();
    await t.sm.startSession(FAKE_TV.id);
    await t.sm.endCurrentSession(true);
    await t.sm.endCurrentSession(true);
    await wait(60);
    expect(t.events.filter((e) => e === "ended")).toHaveLength(1);
  });
});

describe("fake cast options from the build's env", () => {
  it("EXPO_PUBLIC_FAKE_CAST_END_MS turns on Cast's real end timing; _URL_2 gives the Bedroom TV its own fake Chromecast", () => {
    expect(
      fakeCastOptions({
        EXPO_PUBLIC_FAKE_CAST_END_MS: "1500",
        EXPO_PUBLIC_FAKE_CAST_URL_2: "http://localhost:5182/load",
      }),
    ).toEqual({
      endedAfterMs: 1500,
      loadUrls: { [FAKE_TV_2.id]: "http://localhost:5182/load" },
    });
  });

  it("unset or not a number: neither", () => {
    expect(fakeCastOptions({})).toEqual({});
    expect(fakeCastOptions({ EXPO_PUBLIC_FAKE_CAST_END_MS: "soon" })).toEqual({});
    expect(fakeCastOptions({ EXPO_PUBLIC_FAKE_CAST_END_MS: "0" })).toEqual({ endedAfterMs: 0 });
  });
});

describe("fake cast, the ending event (immediate mode)", () => {
  it("fires ending, then ended, before endCurrentSession resolves", async () => {
    const { sessionManager: sm } = createFakeCastBackend({
      mode: "one",
      loadUrl: "x",
      fetch: async () => new Response("{}"),
    });
    const events: string[] = [];
    sm.onSessionEnding?.(() => events.push("ending"));
    sm.onSessionEnded(() => events.push("ended"));
    await sm.startSession(FAKE_TV.id);
    await sm.endCurrentSession(true);
    expect(events).toEqual(["ending", "ended"]);
  });
});
