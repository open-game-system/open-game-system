jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: { showCastDialog: jest.fn() },
}));

import { createCastStore } from "../cast-store";
import { castCommands, startCastSync } from "../cast-sync";
import { createCastTrace } from "../cast-trace";
import { connectViewChannel } from "../cast-view";
import { type ClientLog, type EventFields, hashId } from "../client-log";
import { createFakeCastBackend, FAKE_TV } from "../fake-cast";

/** Native session events and the LOAD_VIEW handshake, as wide events. */

type Logged = { name: string } & EventFields;
const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
};

function recorder() {
  const events: Logged[] = [];
  const log: ClientLog = {
    event: (name, fields = {}) => void events.push({ name, ...fields }),
    flush: async () => {},
    background: async () => {},
    restore: async () => {},
  };
  return { events, trace: createCastTrace(log), names: () => events.map((e) => e.name) };
}

function session(opts: { send?: () => Promise<void>; addChannel?: () => Promise<never> } = {}) {
  type Msg = Record<string, unknown> | string;
  let listener: (m: Msg) => void = () => {};
  const channel = {
    sendMessage: jest.fn(opts.send ?? (async () => {})),
    onMessage: (l: (m: Msg) => void) => {
      listener = l;
    },
  };
  return {
    channel,
    receive: (m: Msg) => listener(m),
    addChannel: opts.addChannel ?? (async () => channel),
  };
}

describe("cast sync log: the native session events", () => {
  it("logs starting, started (TV hashed), ending, ended under the current attempt", async () => {
    const r = recorder();
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://tv.test/load",
      fetch: async () => new Response("{}"),
    });
    const store = createCastStore();
    startCastSync(store, backend.sessionManager, castCommands(), "s", r.trace);
    const attempt = r.trace.begin("cast");
    store.dispatch({ type: "SET_VIEW_URL", url: "http://tv/?token=secret-token" });
    await backend.sessionManager.startSession(FAKE_TV.id);
    await flush();
    await backend.sessionManager.endCurrentSession(true);
    await flush();
    expect(r.names()).toEqual([
      "cast.cast.requested",
      "cast.session.starting",
      "cast.session.started",
      "cast.session.connected",
      "cast.load_view.sent",
      "cast.session.ending",
      "cast.session.ended",
    ]);
    expect(r.events.every((e) => e.attemptId === attempt)).toBe(true);
    expect(r.events.find((e) => e.name === "cast.session.connected")?.data).toEqual({
      tv: hashId(FAKE_TV.id),
    });
    // LOAD_VIEW names the view's host, never the URL (its token).
    expect(JSON.stringify(r.events)).not.toContain("secret-token");
  });

  it("logs a failed start with the SDK's error, suspended, resumed and ended with an error", () => {
    const r = recorder();
    const h: Record<string, (...a: never[]) => void> = {};
    const sub = (k: string) => (f: (...a: never[]) => void) => {
      h[k] = f;
      return { remove() {} };
    };
    const sm = {
      getCurrentCastSession: async () => null,
      startSession: async () => true,
      endCurrentSession: async () => {},
      onSessionStarting: sub("starting"),
      onSessionStarted: sub("started"),
      onSessionStartFailed: sub("startFailed"),
      onSessionSuspended: sub("suspended"),
      onSessionResumed: sub("resumed"),
      onSessionEnding: sub("ending"),
      onSessionEnded: sub("ended"),
    };
    startCastSync(createCastStore(), sm, castCommands(), "s", r.trace);
    (h.startFailed as (s: unknown, e: string) => void)({}, "Receiver app launch failed");
    (h.suspended as () => void)();
    (h.ended as (s: unknown, e: string | null) => void)({}, "Network error");
    expect(r.events).toEqual([
      expect.objectContaining({
        name: "cast.session.start_failed",
        error: "Receiver app launch failed",
      }),
      expect.objectContaining({ name: "cast.session.suspended", level: "warn" }),
      expect.objectContaining({ name: "cast.session.ended", error: "Network error" }),
    ]);
  });

  it("a session already running at launch is logged as found", async () => {
    const r = recorder();
    const backend = createFakeCastBackend({
      mode: "one",
      loadUrl: "http://tv.test/load",
      fetch: async () => new Response("{}"),
    });
    await backend.sessionManager.startSession(FAKE_TV.id);
    startCastSync(createCastStore(), backend.sessionManager, castCommands(), "s", r.trace);
    await flush();
    expect(r.names()[0]).toBe("cast.session.found");
  });

  it("the game's own cast buttons: a start or stop that fails is logged", async () => {
    const r = recorder();
    const commands = castCommands(() => {}, r.trace);
    commands.bind({
      startSession: async () => {
        throw new Error("busy");
      },
      endCurrentSession: async () => {
        throw new Error("no session");
      },
    } as never);
    commands.startCasting("tv", [{ id: "tv", name: "TV", type: "chromecast" }]);
    commands.stopCasting();
    await flush();
    expect(r.names().sort()).toEqual(["cast.game_start.rejected", "cast.game_stop.rejected"]);
  });
});

describe("LOAD_VIEW handshake log", () => {
  it("sent (with the view's host and timing), and again on the receiver's REQUEST_VIEW", async () => {
    const r = recorder();
    const s = session();
    await connectViewChannel(s, () => "http://tv.local:5180/?token=t", "https://stream", r.trace);
    s.receive(JSON.stringify({ type: "REQUEST_VIEW" }));
    await flush();
    expect(r.names()).toEqual([
      "cast.load_view.sent",
      "cast.view_request.received",
      "cast.load_view.sent",
    ]);
    expect(r.events[0].data).toEqual({ host: "tv.local:5180", reason: "connect" });
    expect(r.events[2].data).toEqual({ host: "tv.local:5180", reason: "request" });
  });

  it("no view yet: logged as skipped", async () => {
    const r = recorder();
    await connectViewChannel(session(), () => null, "s", r.trace);
    expect(r.events[0]).toMatchObject({ name: "cast.load_view.skipped", level: "warn" });
  });

  it("a send that fails and a channel that can't open are errors", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const r = recorder();
    await connectViewChannel(
      session({
        send: async () => {
          throw new Error("channel closed");
        },
      }),
      () => "http://tv/",
      "s",
      r.trace,
    );
    await connectViewChannel(
      session({
        addChannel: async () => {
          throw new Error("not connected");
        },
      }),
      () => "http://tv/",
      "s",
      r.trace,
    );
    expect(r.events).toEqual([
      expect.objectContaining({ name: "cast.load_view.failed", error: expect.any(Error) }),
      expect.objectContaining({ name: "cast.view_channel.failed", error: expect.any(Error) }),
    ]);
    warn.mockRestore();
  });
});
