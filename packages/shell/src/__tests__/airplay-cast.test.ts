import { fakeAirplayDisplay as fakeDisplay } from "../__fixtures__/fake-airplay";
import { AIRPLAY_DEVICE_ID, AIRPLAY_LABEL, createAirplayCastBackend } from "../airplay-cast";
import { createAirplaySheet } from "../airplay-sheet";

/**
 * The AirPlay TV as one more cast backend (docs/acceptance/2026-10-23-airplay-display.feature):
 * listed when an AirPlay receiver is around or a display is connected, started through Control
 * Center's Screen Mirroring (the sheet shows how), and fed the same LOAD_VIEW a Chromecast gets: its
 * view URL (the OGS TV launcher with the launcher token) goes to the phone's TV window.
 */
const flush = () => new Promise((r) => setTimeout(r, 0));
const LAUNCHER = "https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.example&token=eyJ.a.b";

async function setup(opts: Parameters<typeof fakeDisplay>[0] = {}) {
  const fake = fakeDisplay(opts);
  const sheet = createAirplaySheet();
  const log = jest.fn();
  const backend = createAirplayCastBackend({ display: fake.display, sheet, log });
  await flush();
  return { fake, sheet, log, backend };
}

function lifecycle(backend: Awaited<ReturnType<typeof setup>>["backend"]) {
  const seen: string[] = [];
  const sm = backend.sessionManager;
  sm.onSessionStarting(() => seen.push("starting"));
  sm.onSessionStarted(() => seen.push("started"));
  sm.onSessionStartFailed((_s, e) => seen.push(`failed ${e}`));
  sm.onSessionEnding?.(() => seen.push("ending"));
  sm.onSessionEnded(() => seen.push("ended"));
  sm.onSessionSuspended(() => seen.push("suspended"));
  sm.onSessionResumed(() => seen.push("resumed"));
  return seen;
}

describe("the AirPlay TV in the device list", () => {
  it("is not offered without the native module (Android, Expo Go, tests)", async () => {
    const { backend } = await setup({
      available: false,
      display: { name: "TV", width: 1, height: 1 },
    });
    backend.startDiscovery();
    await flush();
    expect(backend.getDevices()).toEqual([]);
  });

  it("is not offered when no AirPlay receiver is around and no display is connected", async () => {
    const { backend } = await setup();
    backend.startDiscovery();
    await flush();
    expect(backend.getDevices()).toEqual([]);
  });

  it("is offered as 'Apple TV / AirPlay' once the search finds a receiver", async () => {
    const { backend, fake } = await setup({ routes: true });
    const lists: unknown[] = [];
    backend.subscribeDevices((d) => lists.push(d));
    backend.startDiscovery();
    await flush();
    expect(fake.display.detectRoutes).toHaveBeenCalledWith(30);
    expect(backend.getDevices()).toEqual([
      { id: AIRPLAY_DEVICE_ID, name: AIRPLAY_LABEL, type: "airplay" },
    ]);
    expect(lists).toEqual([[{ id: "airplay", name: "Apple TV / AirPlay", type: "airplay" }]]);
  });

  it("follows the receivers coming and going while it searches", async () => {
    const { backend, fake } = await setup();
    fake.routes(true);
    expect(backend.getDevices()).toHaveLength(1);
    const before = backend.getDevices();
    fake.routes(true);
    expect(backend.getDevices()).toBe(before);
    fake.routes(false);
    expect(backend.getDevices()).toEqual([]);
  });

  it("is named after the connected display, and offered while one is connected", async () => {
    const { backend, fake } = await setup({
      display: { name: "Kitchen", width: 1920, height: 1080 },
    });
    expect(backend.getDevices()).toEqual([{ id: "airplay", name: "Kitchen", type: "airplay" }]);
    fake.disconnect();
    expect(backend.getDevices()).toEqual([]);
    fake.connect({ name: "TV", width: 1280, height: 720 });
    // iOS names no receiver (the Simulator's display, a cable): the generic label.
    expect(backend.getDevices()).toEqual([{ id: "airplay", name: AIRPLAY_LABEL, type: "airplay" }]);
  });
});

describe("casting to the AirPlay TV", () => {
  it("with a display already connected: starts at once and shows the launcher the cast names", async () => {
    const { backend, fake, sheet } = await setup({
      display: { name: "Kitchen", width: 1920, height: 1080 },
    });
    const seen = lifecycle(backend);
    await expect(backend.sessionManager.startSession(AIRPLAY_DEVICE_ID)).resolves.toBe(true);
    expect(seen).toEqual(["starting", "started"]);
    expect(sheet.get().open).toBe(false);

    const session = await backend.sessionManager.getCurrentCastSession();
    expect(session).not.toBeNull();
    await expect(session?.getCastDevice()).resolves.toEqual({
      deviceId: "airplay",
      friendlyName: "Kitchen",
    });
    const channel = await session?.addChannel("urn:x-cast:org.opengame.view");
    await channel?.sendMessage({
      type: "LOAD_VIEW",
      viewUrl: LAUNCHER,
      streamServerUrl: "https://s",
    });
    // As a string too (some senders stringify).
    await channel?.sendMessage(JSON.stringify({ type: "LOAD_VIEW", viewUrl: `${LAUNCHER}2` }));
    expect(fake.calls).toEqual([`start ${LAUNCHER}`, `start ${LAUNCHER}2`]);
  });

  it("ignores messages that are not a LOAD_VIEW with a URL", async () => {
    const { backend, fake } = await setup({ display: { name: "Kitchen", width: 1, height: 1 } });
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    const session = await backend.sessionManager.getCurrentCastSession();
    const channel = await session?.addChannel("urn:x-cast:org.opengame.view");
    channel?.onMessage(() => {});
    await channel?.sendMessage({ type: "STOP" });
    await channel?.sendMessage("not json");
    await channel?.sendMessage({ type: "LOAD_VIEW", viewUrl: "not a url" });
    expect(fake.calls).toEqual([]);
  });

  it("without a display: opens the Screen Mirroring steps and starts when the TV's display connects", async () => {
    const { backend, fake, sheet, log } = await setup({ routes: true });
    const seen = lifecycle(backend);
    const started = backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    await flush();
    expect(seen).toEqual(["starting"]);
    expect(sheet.get()).toEqual({ open: true, mode: "steps" });
    expect(log).toHaveBeenCalledWith("airplay.sheet_open", { mode: "steps" }, "info");

    fake.connect();
    await expect(started).resolves.toBe(true);
    expect(seen).toEqual(["starting", "started"]);
    expect(sheet.get().open).toBe(false);
    expect(log).toHaveBeenCalledWith(
      "airplay.connected",
      { name: "Kitchen", width: 1920, height: 1080, waiting: true },
      "info",
    );
  });

  it("the user closes the steps: no session, and the start says no", async () => {
    const { backend, sheet, log } = await setup({ routes: true });
    const seen = lifecycle(backend);
    const started = backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    await flush();
    sheet.close();
    await expect(started).resolves.toBe(false);
    expect(seen).toEqual(["starting", "ended"]);
    await expect(backend.sessionManager.getCurrentCastSession()).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(
      "airplay.sheet_close",
      { mode: "steps", connected: false },
      "info",
    );
  });

  it("sound-only AirPlay while waiting: the steps say so (and not when nothing waits)", async () => {
    const { backend, fake, sheet, log } = await setup({ routes: true });
    fake.audioOnly("Kitchen");
    expect(sheet.get().open).toBe(false);

    void backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    await flush();
    fake.audioOnly("Kitchen");
    expect(sheet.get()).toEqual({ open: true, mode: "audio-only" });
    expect(log).toHaveBeenCalledWith("airplay.audio_only", { name: "Kitchen" }, "warn");
  });

  it("refuses another device id", async () => {
    const { backend } = await setup({ display: { name: "Kitchen", width: 1, height: 1 } });
    const seen = lifecycle(backend);
    await expect(backend.sessionManager.startSession("chromecast-1")).resolves.toBe(false);
    expect(seen).toEqual([]);
  });

  it("a second start while one waits uses the same wait", async () => {
    const { backend, fake } = await setup({ routes: true });
    const seen = lifecycle(backend);
    const a = backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    const b = backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    await flush();
    fake.connect();
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(seen).toEqual(["starting", "started"]);
  });

  it("a start while casting to it is already done", async () => {
    const { backend } = await setup({ display: { name: "Kitchen", width: 1, height: 1 } });
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    const seen = lifecycle(backend);
    await expect(backend.sessionManager.startSession(AIRPLAY_DEVICE_ID)).resolves.toBe(true);
    expect(seen).toEqual([]);
  });
});

describe("ending the AirPlay cast", () => {
  it("Stop casting: the TV goes back to its idle card and the session ends", async () => {
    const { backend, fake } = await setup({ display: { name: "Kitchen", width: 1, height: 1 } });
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    const seen = lifecycle(backend);
    await backend.sessionManager.endCurrentSession(true);
    expect(seen).toEqual(["ending", "ended"]);
    expect(fake.calls).toEqual(["stop"]);
    await expect(backend.sessionManager.getCurrentCastSession()).resolves.toBeNull();
    await backend.sessionManager.endCurrentSession(true);
    expect(seen).toEqual(["ending", "ended"]);
  });

  it("the user stops Screen Mirroring: the session ends", async () => {
    const { backend, fake, log } = await setup({
      display: { name: "Kitchen", width: 1, height: 1 },
    });
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    const seen = lifecycle(backend);
    fake.disconnect();
    await flush();
    expect(seen).toEqual(["ended"]);
    expect(fake.calls).toEqual(["stop"]);
    expect(log).toHaveBeenCalledWith("airplay.disconnected", { casting: true }, "info");
    fake.disconnect();
    expect(seen).toEqual(["ended"]);
  });

  it("dispose removes every native listener", async () => {
    const { backend, fake } = await setup();
    expect(fake.listeners()).toBe(4);
    backend.dispose();
    expect(fake.listeners()).toBe(0);
  });
});

describe("keep the app open", () => {
  it("going to the background while casting to the AirPlay TV notifies once per trip away", async () => {
    const fake = fakeDisplay({ display: { name: "Kitchen", width: 1, height: 1 } });
    const app: { change?: ((state: string) => void) | null } = {};
    const notifyAway = jest.fn(async () => {});
    const log = jest.fn();
    const backend = createAirplayCastBackend({
      display: fake.display,
      sheet: createAirplaySheet(),
      log,
      notifyAway,
      appState: {
        addEventListener: (_t, l) => {
          app.change = l;
          return {
            remove: () => {
              app.change = null;
            },
          };
        },
      },
    });
    await flush();
    app.change?.("background");
    expect(notifyAway).not.toHaveBeenCalled();

    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    app.change?.("inactive");
    app.change?.("background");
    app.change?.("background");
    expect(notifyAway).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("airplay.away", { state: "background" }, "info");
    app.change?.("active");
    app.change?.("background");
    expect(notifyAway).toHaveBeenCalledTimes(2);
    backend.dispose();
    expect(app.change).toBeNull();
  });

  it("a failed notification is logged, not thrown", async () => {
    const fake = fakeDisplay({ display: { name: "Kitchen", width: 1, height: 1 } });
    const app: { change?: ((state: string) => void) | null } = {};
    const log = jest.fn();
    const backend = createAirplayCastBackend({
      display: fake.display,
      sheet: createAirplaySheet(),
      log,
      notifyAway: async () => {
        throw new Error("no permission");
      },
      appState: {
        addEventListener: (_t, l) => {
          app.change = l;
          return { remove() {} };
        },
      },
    });
    await backend.sessionManager.startSession(AIRPLAY_DEVICE_ID);
    app.change?.("background");
    await flush();
    expect(log).toHaveBeenCalledWith("airplay.away_failed", { error: "no permission" }, "warn");
  });
});
