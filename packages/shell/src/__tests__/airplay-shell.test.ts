import { fakeAirplayDisplay } from "../__fixtures__/fake-airplay";
import { fakeContext } from "../__fixtures__/fake-context";
import { fakeFetch } from "../__fixtures__/fake-fetch";
import { AIRPLAY_DEVICE_ID } from "../airplay-cast";
import type { NativeLogEvent, NativeLogSource } from "../airplay-display";
import { shellAirplay } from "../airplay-shell";
import type { ShellIdentity } from "../shell-identity";

/**
 * docs/acceptance/2026-10-23-airplay-display.feature, "Everything the phone does for the TV is
 * logged": a game's own app with airplay on logs its AirPlay steps and every native event to
 * POST /api/v1/client-events under its profile token, one launch id per run.
 */
const ID: ShellIdentity = {
  profile: { id: "p1", handle: "player", name: "Player", sticker: "owl" },
  deviceId: "d1",
  deviceToken: "tok",
  login: "guest",
};

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error("timed out");
};

function nativeLog(ring: NativeLogEvent[]) {
  let live: ((e: NativeLogEvent) => void) | null = null;
  const src: NativeLogSource = {
    available: true,
    recentLog: async () => ring,
    onLog: (l) => {
      live = l;
      return {
        remove: () => {
          live = null;
        },
      };
    },
    log: async () => {},
  };
  return { src, emit: (e: NativeLogEvent) => live?.(e), listening: () => live !== null };
}

function setup(opts: { granted?: boolean } = {}) {
  const net = fakeFetch({
    "POST /api/v1/client-events": () => ({ status: 202, body: { accepted: 1 } }),
  });
  const display = fakeAirplayDisplay({ display: { name: "Kitchen", width: 1920, height: 1080 } });
  const log = nativeLog([
    { seq: 1, at: 5, type: "display.attach", level: "info", data: { w: 1920 } },
  ]);
  const listeners = new Set<(s: string) => void>();
  const app = {
    change: (s: string) => {
      for (const l of listeners) l(s);
    },
  };
  const scheduled: unknown[] = [];
  const context = fakeContext(net.fetch, { appId: "settlewood", name: "Settlewood" });
  const make = shellAirplay({
    display: display.display,
    nativeLog: log.src,
    fetch: net.fetch,
    now: () => 1000,
    newId: () => "abc123",
    platform: "ios 26.4",
    version: "1.0.0",
    build: "7",
    appState: {
      addEventListener: (_t, l) => {
        listeners.add(l);
        return { remove: () => void listeners.delete(l) };
      },
    },
    notifications: {
      getPermissionsAsync: async () => ({ granted: opts.granted ?? true }),
      scheduleNotificationAsync: async (req) => void scheduled.push(req),
    },
    flushMs: 1,
  });
  const backend = make(context.ctx);
  context.ctx.onStop(() => backend.dispose());
  return { net, display, log, app, scheduled, context, backend };
}

const posted = (net: ReturnType<typeof fakeFetch>) =>
  net.calls.filter((c) => c.url === "https://api.test/api/v1/client-events");

describe("shellAirplay: a game's own app", () => {
  it("logs native events and AirPlay steps under the profile token, with the launch's context", async () => {
    const { net, context, backend, log } = setup();
    context.setIdentity(ID);
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    log.emit({ seq: 2, at: 6, type: "keep_awake", level: "info", data: { on: true } });
    await until(() => posted(net).length > 0);
    const call = posted(net)[0];
    expect(call?.headers.Authorization).toBe("Bearer tok");
    expect(call?.body).toMatchObject({
      context: {
        app: "shell",
        appId: "settlewood",
        launchId: "launch-abc123",
        platform: "ios 26.4",
        version: "1.0.0",
        build: "7",
      },
    });
    await until(() => JSON.stringify(posted(net).map((c) => c.body)).includes("native.keep_awake"));
    const names = posted(net).flatMap((c) => {
      const body = c.body;
      return typeof body === "object" &&
        body !== null &&
        "events" in body &&
        Array.isArray(body.events)
        ? body.events.map((e: { name: string }) => e.name)
        : [];
    });
    expect(names).toEqual(
      expect.arrayContaining(["native.display.attach", "airplay.start", "native.keep_awake"]),
    );
  });

  it("keeps events until there is a profile to send them with", async () => {
    const { net, context, backend } = setup();
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    await new Promise((r) => setTimeout(r, 20));
    expect(posted(net)).toHaveLength(0);
    context.setIdentity(ID);
    context.stop();
    // Stopping flushes what waited.
    await until(() => posted(net).length > 0);
  });

  it("going to the background while casting: a local 'keep the app open' notice, once", async () => {
    const { app, backend, scheduled } = setup();
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    app.change("background");
    await until(() => scheduled.length > 0);
    expect(scheduled).toEqual([
      {
        content: { title: "Settlewood", body: "Open Settlewood to keep the TV going" },
        trigger: null,
      },
    ]);
  });

  it("no notice without notification permission", async () => {
    const { app, backend, scheduled } = setup({ granted: false });
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    app.change("background");
    await new Promise((r) => setTimeout(r, 20));
    expect(scheduled).toEqual([]);
  });

  it("stopping the app stops the native log forward", () => {
    const { context, log } = setup();
    expect(log.listening()).toBe(true);
    context.stop();
    expect(log.listening()).toBe(false);
  });
});
