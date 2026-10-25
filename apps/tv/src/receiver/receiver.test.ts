import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrameMeter } from "./frame-stats";
import { type CastHost, createReceiver, type Detected, type ViewFrame } from "./receiver";
import type { RxFields } from "./rx-log";

const RX = "https://rx.example";
const LAUNCHER = "https://ogs-tv.pages.dev/?api=https%3A%2F%2Fapi.example&token=abc.def.ghi";
const DETECTED: Detected = {
  choice: { tier: "lite", reasons: ["device:google-tv"], deviceClass: "google-tv" },
  signals: {
    userAgent: "CrKey/1.56 DeviceType/AndroidTV Android",
    webgl: { renderer: "Mali-G31", maxTextureSize: 8192 },
    frame: { p50Ms: 16.7, p90Ms: 18.2, frames: 80 },
    deviceMemoryGb: 2,
  },
  probeMs: 1400,
};

function fakeHost() {
  let onMessage: ((data: unknown, reply: (m: object) => void) => void) | null = null;
  let onSenders: ((state: "connected" | "disconnected", count: number) => void) | null = null;
  const broadcasts: object[] = [];
  const replies: object[] = [];
  const host: CastHost = {
    start: vi.fn(),
    stop: vi.fn(),
    onMessage: (h) => {
      onMessage = h;
    },
    onSenders: (h) => {
      onSenders = h;
    },
    broadcast: (m) => broadcasts.push(m),
  };
  return {
    host,
    broadcasts,
    replies,
    send: (data: unknown) => onMessage?.(data, (m) => replies.push(m)),
    senders: (state: "connected" | "disconnected", count: number) => onSenders?.(state, count),
  };
}

function setup(
  opts: { detect?: Promise<Detected>; loadMs?: number; result?: "loaded" | "timeout" } = {},
) {
  const h = fakeHost();
  const loads: string[] = [];
  const frame: ViewFrame = {
    load: vi.fn(async (url: string) => {
      loads.push(url);
      await new Promise((r) => setTimeout(r, opts.loadMs ?? 500));
      return opts.result ?? "loaded";
    }),
  };
  const statuses: (string | null)[] = [];
  const events: { name: string; f: RxFields }[] = [];
  const log = {
    event: vi.fn((name: string, f: RxFields = {}) => events.push({ name, f })),
    setApi: vi.fn(),
    join: vi.fn(),
    flush: vi.fn(),
  };
  const meter = createFrameMeter();
  const rx = createReceiver({
    host: h.host,
    frame,
    status: (t) => statuses.push(t),
    log,
    detect: () => opts.detect ?? Promise.resolve(DETECTED),
    origin: RX,
    meter,
    launchedAt: 0,
  });
  rx.start();
  const named = (n: string) => events.filter((e) => e.name === n);
  return { ...h, loads, statuses, events, named, log, rx, meter, frame };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});
afterEach(() => vi.useRealTimers());

describe("the local Cast receiver", () => {
  it("starts Cast and asks senders for the view until one arrives", async () => {
    const r = setup();
    expect(r.host.start).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(
      r.broadcasts.filter((m) => "type" in m && m.type === "REQUEST_VIEW").length,
    ).toBeGreaterThanOrEqual(2);
    expect(r.broadcasts[0]).toEqual({ type: "REQUEST_VIEW", accepts: ["view"] });
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    const before = r.broadcasts.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(r.broadcasts.length).toBe(before);
  });

  it("asks a sender for the view as soon as it connects", async () => {
    const r = setup();
    r.senders("connected", 1);
    expect(r.broadcasts).toContainEqual({ type: "REQUEST_VIEW", accepts: ["view"] });
    expect(r.named("sender")[0]?.f.data).toEqual({ state: "connected", count: 1 });
  });

  it("logs the tier it chose, with the signals behind it", async () => {
    const r = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(r.named("tier")[0]?.f).toEqual({
      durationMs: 1400,
      data: {
        tier: "lite",
        reasons: "device:google-tv",
        deviceClass: "google-tv",
        gpu: "Mali-G31",
        maxTexture: 8192,
        probeP50Ms: 16.7,
        probeP90Ms: 18.2,
        probeFrames: 80,
        memoryGb: 2,
        heapLimitMb: null,
      },
    });
  });

  it("renders the launcher locally: frames it from its own site with the tier, logs the load time", async () => {
    const r = setup({ loadMs: 1200 });
    r.send({
      type: "LOAD_VIEW",
      viewUrl: LAUNCHER,
      streamServerUrl: "https://ignored",
      attemptId: "cast-1",
      sessionId: "s1",
    });
    expect(r.log.join).toHaveBeenCalledWith({ phoneAttemptId: "cast-1", sessionId: "s1" });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.loads).toEqual([`${RX}/?api=https%3A%2F%2Fapi.example&token=abc.def.ghi&tier=lite`]);
    expect(r.log.setApi).toHaveBeenCalledWith("https://api.example");
    expect(r.named("load_view.received")[0]?.f.data).toEqual({
      view: "ogs-tv.pages.dev",
      launcher: true,
      tier: "lite",
    });
    await vi.advanceTimersByTimeAsync(1200);
    expect(r.named("view.loaded")[0]?.f).toEqual({
      durationMs: 1200,
      data: { view: "ogs-tv.pages.dev", tier: "lite", sinceLaunchMs: 11_200 },
    });
    expect(r.statuses.at(-1)).toBeNull();
  });

  it("logs to the API the phone names (apiUrl, PR #55's LOAD_VIEW) before the launcher's api=", async () => {
    const r = setup();
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER, apiUrl: "http://192.168.1.4:8787/" });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.log.setApi).toHaveBeenCalledWith("http://192.168.1.4:8787");
    expect(r.log.setApi).not.toHaveBeenCalledWith("https://api.example");
  });

  it("an apiUrl that isn't an http(s) URL is ignored for the launcher's api=", async () => {
    const r = setup();
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER, apiUrl: "javascript:x" });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.log.setApi).toHaveBeenCalledWith("https://api.example");
  });

  it("waits for tier detection before it frames anything", async () => {
    let resolve: (d: Detected) => void = () => {};
    const r = setup({ detect: new Promise((res) => (resolve = res)) });
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(5000);
    expect(r.loads).toEqual([]);
    resolve(DETECTED);
    await vi.advanceTimersByTimeAsync(0);
    expect(r.loads).toHaveLength(1);
  });

  it("the phone's repeated LOAD_VIEW while the tier is still being measured loads it once", async () => {
    let resolve: (d: Detected) => void = () => {};
    const r = setup({ detect: new Promise((res) => (resolve = res)) });
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    resolve(DETECTED);
    await vi.advanceTimersByTimeAsync(600);
    expect(r.loads).toHaveLength(1);
  });

  it("a newer view sent while the tier is measured wins over the older one", async () => {
    let resolve: (d: Detected) => void = () => {};
    const r = setup({ detect: new Promise((res) => (resolve = res)) });
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    r.send({ type: "LOAD_VIEW", viewUrl: `${LAUNCHER}2` });
    resolve(DETECTED);
    await vi.advanceTimersByTimeAsync(600);
    expect(r.loads).toEqual([`${RX}/?api=https%3A%2F%2Fapi.example&token=abc.def.ghi2&tier=lite`]);
  });

  it("ignores the same view again (the phone's handshake repeats it), once logged", async () => {
    const r = setup();
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    expect(r.loads).toHaveLength(1);
    expect(r.named("load_view.ignored")[0]?.f.data).toEqual({
      why: "duplicate",
      view: "ogs-tv.pages.dev",
    });
  });

  it("a new view replaces the old one", async () => {
    const r = setup();
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    r.send({ type: "LOAD_VIEW", viewUrl: `${LAUNCHER}x` });
    await vi.advanceTimersByTimeAsync(600);
    expect(r.loads).toHaveLength(2);
  });

  it("a view that never loads says so on the TV and in the log", async () => {
    const r = setup({ result: "timeout" });
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    expect(r.named("view.timeout")[0]?.f).toMatchObject({
      level: "error",
      error: "the view didn't load",
      now: true,
    });
    expect(r.statuses.at(-1)).toBe("The TV page didn't load. Try casting again.");
  });

  it("refuses a view that isn't an http(s) URL", async () => {
    const r = setup();
    r.send({ type: "LOAD_VIEW", viewUrl: "javascript:alert(1)" });
    await vi.advanceTimersByTimeAsync(600);
    expect(r.loads).toEqual([]);
    expect(r.named("load_view.invalid")).toHaveLength(1);
  });

  it("answers a laptop's PEER_OFFER with PEER_ERROR (this receiver renders locally)", () => {
    const r = setup();
    r.send({ type: "PEER_OFFER", sdp: "v=0" });
    expect(r.replies).toEqual([
      { type: "PEER_ERROR", error: "This TV renders the launcher itself; it takes no peer stream" },
    ]);
  });

  it("ignores messages that aren't the protocol", () => {
    const r = setup();
    r.send("nonsense");
    r.send({ type: "LOAD_VIEW" });
    r.send(null);
    expect(r.loads).toEqual([]);
    expect(r.named("message.ignored")).toHaveLength(3);
  });

  it("answers GET_STATE with what it shows, its tier and the latest frame rate", async () => {
    const r = setup();
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    for (let i = 0; i <= 30; i++) r.meter.tick(i * 33.3);
    await vi.advanceTimersByTimeAsync(60_000);
    r.send({ type: "GET_STATE" });
    expect(r.replies[0]).toMatchObject({
      type: "STATE",
      started: true,
      view: "ogs-tv.pages.dev",
      loaded: true,
      tier: "lite",
      reasons: ["device:google-tv"],
      fps: { fps: 30, frames: 30 },
    });
  });

  it("logs a frame-rate summary every minute while a view is up, with the tier", async () => {
    const r = setup();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(r.named("fps")).toHaveLength(0);
    r.send({ type: "LOAD_VIEW", viewUrl: LAUNCHER });
    await vi.advanceTimersByTimeAsync(600);
    for (let i = 0; i <= 60; i++) r.meter.tick(i * 16.7);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(r.named("fps")[0]?.f.data).toMatchObject({
      tier: "lite",
      fps: 59.9,
      frames: 60,
      longFrames: 0,
    });
  });

  it("logs each sender leaving, and ends the cast 20 minutes after the last one left", async () => {
    const r = setup();
    r.senders("connected", 1);
    r.senders("disconnected", 0);
    expect(r.named("sender").at(-1)?.f.data).toEqual({ state: "disconnected", count: 0 });
    await vi.advanceTimersByTimeAsync(20 * 60_000 - 1);
    expect(r.host.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(r.host.stop).toHaveBeenCalled();
    expect(r.named("cast.ended")[0]?.f).toMatchObject({
      data: { why: "no phone connected for 20 min" },
      now: true,
    });
  });

  it("a phone coming back within 20 minutes keeps the cast", async () => {
    const r = setup();
    r.senders("disconnected", 0);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    r.senders("connected", 1);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(r.host.stop).not.toHaveBeenCalled();
  });

  it("a sender leaving while others stay doesn't start the stop timer", async () => {
    const r = setup();
    r.senders("disconnected", 1);
    await vi.advanceTimersByTimeAsync(25 * 60_000);
    expect(r.host.stop).not.toHaveBeenCalled();
  });

  it("ends any cast after 3 hours", async () => {
    const r = setup();
    r.senders("connected", 1);
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000);
    expect(r.host.stop).toHaveBeenCalledTimes(1);
    expect(r.named("cast.ended")[0]?.f.data).toEqual({ why: "the cast reached 3 hours" });
  });
});
