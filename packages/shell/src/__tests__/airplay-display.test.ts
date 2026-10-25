import {
  type AirplayDisplayNative,
  type AirplayEvents,
  airplayDisplayOf,
  type NativeLogData,
  type NativeLogEvent,
  nativeLogOf,
  noAirplayDisplay,
  noNativeLog,
} from "../airplay-display";
import { createAirplaySheet } from "../airplay-sheet";

function fakeNative() {
  const listeners: { [K in keyof AirplayEvents]: ((p: AirplayEvents[K]) => void)[] } = {
    onConnect: [],
    onDisconnect: [],
    onLog: [],
    onAudioOnlyAirPlay: [],
    onRoutes: [],
  };
  const raw = {
    start: jest.fn(async (_url: string) => {}),
    stop: jest.fn(async () => {}),
    setAppName: jest.fn(async (_name: string) => {}),
    setIdleCard: jest.fn(async (_line: string, _background: string) => {}),
    setLogContext: jest.fn(async (_context: Record<string, string>) => {}),
    syncPhonePages: jest.fn(async () => {}),
    currentDisplay: jest.fn(async () => ({ name: "Kitchen", width: 1, height: 2 })),
    detectRoutes: jest.fn(async (_seconds: number) => true),
    recentLog: jest.fn(async (_after: number): Promise<NativeLogEvent[]> => []),
    log: jest.fn(async (_type: string, _level: string, _data: NativeLogData) => {}),
  };
  const native: AirplayDisplayNative = {
    ...raw,
    addListener<K extends keyof AirplayEvents>(event: K, l: (p: AirplayEvents[K]) => void) {
      listeners[event].push(l);
      return { remove() {} };
    },
  };
  const fire = <K extends keyof AirplayEvents>(event: K, payload: AirplayEvents[K]) => {
    for (const l of listeners[event]) l(payload);
  };
  return { native, raw, fire };
}

describe("airplayDisplayOf: the module's display half", () => {
  it("without the module: unavailable and inert", async () => {
    const d = airplayDisplayOf(null);
    expect(d).toBe(noAirplayDisplay);
    expect(d.available).toBe(false);
    await expect(d.currentDisplay()).resolves.toBeNull();
    await expect(d.detectRoutes(5)).resolves.toBe(false);
    await expect(d.start("https://x")).resolves.toBeUndefined();
    await expect(d.stop()).resolves.toBeUndefined();
    await expect(d.setAppName("OGS")).resolves.toBeUndefined();
    await expect(d.setIdleCard({ line: "x" })).resolves.toBeUndefined();
    await expect(d.setLogContext({ device: "a" })).resolves.toBeUndefined();
    await expect(d.syncPhonePages()).resolves.toBeUndefined();
    for (const sub of [
      d.onConnect(() => {}),
      d.onDisconnect(() => {}),
      d.onAudioOnlyAirPlay(() => {}),
      d.onRoutes(() => {}),
    ])
      expect(() => sub.remove()).not.toThrow();
  });

  it("with the module: passes calls through and unwraps event payloads", async () => {
    const { native, raw, fire } = fakeNative();
    const d = airplayDisplayOf(native);
    expect(d.available).toBe(true);
    await d.start("https://tv/?token=t");
    await d.stop();
    expect(raw.start).toHaveBeenCalledWith("https://tv/?token=t");
    expect(raw.stop).toHaveBeenCalled();
    await d.setAppName("OGS");
    expect(raw.setAppName).toHaveBeenCalledWith("OGS");
    await d.setIdleCard({
      line: "Open a table on your phone to show it here.",
      background: "#1f3d34",
    });
    expect(raw.setIdleCard).toHaveBeenLastCalledWith(
      "Open a table on your phone to show it here.",
      "#1f3d34",
    );
    await d.setIdleCard({});
    expect(raw.setIdleCard).toHaveBeenLastCalledWith("", "");
    await d.setLogContext({ device: "a-1", session: "app-2" });
    expect(raw.setLogContext).toHaveBeenCalledWith({ device: "a-1", session: "app-2" });
    await d.syncPhonePages();
    expect(raw.syncPhonePages).toHaveBeenCalledTimes(1);
    await expect(d.currentDisplay()).resolves.toEqual({ name: "Kitchen", width: 1, height: 2 });
    await expect(d.detectRoutes(30)).resolves.toBe(true);
    expect(raw.detectRoutes).toHaveBeenCalledWith(30);

    const seen: unknown[] = [];
    d.onConnect((i) => seen.push(["connect", i]));
    d.onDisconnect(() => seen.push(["disconnect"]));
    d.onAudioOnlyAirPlay((n) => seen.push(["audio", n]));
    d.onRoutes((a) => seen.push(["routes", a]));
    fire("onConnect", { name: "Kitchen", width: 3, height: 4 });
    fire("onDisconnect", {});
    fire("onAudioOnlyAirPlay", { name: "Den" });
    fire("onRoutes", { available: false });
    expect(seen).toEqual([
      ["connect", { name: "Kitchen", width: 3, height: 4 }],
      ["disconnect"],
      ["audio", "Den"],
      ["routes", false],
    ]);
  });
});

describe("nativeLogOf: the module's log half", () => {
  it("without the module: no events", async () => {
    const l = nativeLogOf(null);
    expect(l).toBe(noNativeLog);
    await expect(l.recentLog(0)).resolves.toEqual([]);
    await expect(l.log("x", "info", {})).resolves.toBeUndefined();
    expect(() => l.onLog(() => {}).remove()).not.toThrow();
  });

  it("with the module: the ring, live events and logging go through", async () => {
    const { native, raw, fire } = fakeNative();
    const l = nativeLogOf(native);
    expect(l.available).toBe(true);
    await l.recentLog(7);
    expect(raw.recentLog).toHaveBeenCalledWith(7);
    await l.log("keep_awake", "info", { on: true });
    expect(raw.log).toHaveBeenCalledWith("keep_awake", "info", { on: true });
    const got: NativeLogEvent[] = [];
    l.onLog((e) => got.push(e));
    const e: NativeLogEvent = { seq: 1, at: 2, type: "screen.connect", level: "info", data: {} };
    fire("onLog", e);
    expect(got).toEqual([e]);
  });
});

describe("the AirPlay sheet", () => {
  it("opens, changes mode, and tells listeners only on a change", () => {
    const sheet = createAirplaySheet();
    const changes: unknown[] = [];
    const off = sheet.subscribe(() => changes.push(sheet.get()));
    sheet.open();
    sheet.open("steps");
    sheet.open("audio-only");
    expect(changes).toEqual([
      { open: true, mode: "steps" },
      { open: true, mode: "audio-only" },
    ]);
    off();
    sheet.done();
    expect(changes).toHaveLength(2);
    expect(sheet.get()).toEqual({ open: false, mode: "steps" });
  });

  it("close (the user) tells close listeners with the mode it had; done (the TV came) does not", () => {
    const sheet = createAirplaySheet();
    const closed: string[] = [];
    const off = sheet.onClose((m) => closed.push(m));
    sheet.close();
    expect(closed).toEqual([]);
    sheet.open("audio-only");
    sheet.close();
    sheet.open();
    sheet.done();
    expect(closed).toEqual(["audio-only"]);
    off();
    sheet.open();
    sheet.close();
    expect(closed).toEqual(["audio-only"]);
  });
});
