import { z } from "zod";
import type { createFrameMeter, FrameStats } from "./frame-stats";
import type { RxLog } from "./rx-log";
import type { TierChoice, TierSignals } from "./tier";
import { type ReceiverView, receiverView } from "./view-url";

/** The Cast messaging this receiver needs (CAF on a Chromecast; a test relay in a desktop browser). */
export interface CastHost {
  start(): void;
  stop(): void;
  onMessage(handler: (data: unknown, reply: (m: object) => void) => void): void;
  onSenders(handler: (state: "connected" | "disconnected", count: number) => void): void;
  broadcast(m: object): void;
}

/** The frame the launcher is drawn in. */
export interface ViewFrame {
  load(url: string): Promise<"loaded" | "timeout">;
}

export interface Detected {
  choice: TierChoice;
  signals: TierSignals;
  probeMs: number;
}

/** Only the phone's view: this receiver draws the launcher itself (no cloud, no peer stream). */
const ACCEPTS = ["view"];
const ASK_MS = 1500;
const FPS_EVERY_MS = 60_000;
const NO_SENDER_STOP_MS = 20 * 60_000;
const MAX_CAST_MS = 3 * 60 * 60_000;

const LoadView = z.object({
  type: z.literal("LOAD_VIEW"),
  viewUrl: z.string().min(1),
  /** The OGS API the phone uses (PR #55): where this receiver's log goes. */
  apiUrl: z.unknown().optional(),
  attemptId: z.unknown().optional(),
  sessionId: z.unknown().optional(),
});
const Typed = z.object({ type: z.string() });

/** An http(s) URL's origin, else null. */
function apiOrigin(url: unknown): string | null {
  const r = z.string().url().safeParse(url);
  if (!r.success) return null;
  const u = new URL(r.data);
  return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
}

/** What GET_STATE says about the TV (nulls until it is measured). */
function detectedState(d: Detected | null) {
  if (!d)
    return { tier: null, reasons: [], deviceClass: null, gpu: null, probe: null, userAgent: null };
  return {
    tier: d.choice.tier,
    reasons: d.choice.reasons,
    deviceClass: d.choice.deviceClass,
    gpu: d.signals.webgl?.renderer ?? null,
    probe: d.signals.frame,
    userAgent: d.signals.userAgent,
  };
}

/** receiver.tier's data: the choice and the signals behind it (scalars only, for the client log). */
function tierData(d: Detected) {
  const { webgl, frame } = d.signals;
  return {
    tier: d.choice.tier,
    reasons: d.choice.reasons.join(","),
    deviceClass: d.choice.deviceClass,
    gpu: webgl ? webgl.renderer.slice(0, 200) : null,
    maxTexture: webgl ? webgl.maxTextureSize : null,
    ...(frame
      ? { probeP50Ms: frame.p50Ms, probeP90Ms: frame.p90Ms, probeFrames: frame.frames }
      : { probeP50Ms: null, probeP90Ms: null, probeFrames: null }),
    memoryGb: d.signals.deviceMemoryGb ?? null,
    heapLimitMb: d.signals.heapLimitMb ?? null,
  };
}

/**
 * The OGS Cast receiver, rendering locally (ADR 2026-10-25-cast-local-render): it measures the TV
 * (render tier), asks the phone for the view, frames the OGS launcher from its own site with
 * `tier=`, and the launcher does everything else (couch session, ogs:start / suspend / resume,
 * sitting labels), as on an AirPlay or browser TV. Logs load time, tier, a frame-rate summary
 * each minute, senders coming and going and how the cast ended.
 */
export function createReceiver(deps: {
  host: CastHost;
  frame: ViewFrame;
  status: (text: string | null) => void;
  log: Pick<RxLog, "event" | "setApi" | "join">;
  /** Measures the TV; called once Cast has started (CAF's device capabilities need it). */
  detect: () => Promise<Detected>;
  /** The receiver's own origin: the launcher is served from it. */
  origin: string;
  meter: ReturnType<typeof createFrameMeter>;
  /** When the page started (epoch ms), for the view's sinceLaunchMs. */
  launchedAt: number;
}) {
  const { host, log } = deps;
  let detected: Detected | null = null;
  let viewUrl: string | null = null;
  let view: { host: string; loaded: boolean } | null = null;
  let lastFps: FrameStats | null = null;
  let askTimer: ReturnType<typeof setInterval> | null = null;
  let fpsTimer: ReturnType<typeof setInterval> | null = null;
  let noSenderTimer: ReturnType<typeof setTimeout> | null = null;
  let ended = false;
  let detecting: Promise<Detected> | null = null;

  /** The tier is measured once, the first time it is needed. */
  const measure = () => {
    if (!detecting) detecting = deps.detect();
    return detecting;
  };

  const ask = () => host.broadcast({ type: "REQUEST_VIEW", accepts: ACCEPTS });

  const endCast = (why: string) => {
    if (ended) return;
    ended = true;
    if (fpsTimer) clearInterval(fpsTimer);
    fpsTimer = null;
    log.event("cast.ended", { data: { why }, now: true });
    deps.status("This TV session has ended");
    host.stop();
  };

  const logFps = () => {
    const s = deps.meter.drain();
    if (s.frames === 0) return;
    lastFps = s;
    log.event("fps", { data: { tier: detected?.choice.tier ?? null, ...s } });
  };

  /** Is this LOAD_VIEW a new, valid view? Decided at once, before the tier is known. */
  const accept = (msg: z.infer<typeof LoadView>) => {
    log.join({ phoneAttemptId: msg.attemptId, sessionId: msg.sessionId });
    if (!receiverView(msg.viewUrl, deps.origin, "full")) {
      log.event("load_view.invalid", { level: "warn" });
      return false;
    }
    // The phone repeats its view (on connect and on each REQUEST_VIEW): a repeat sent during the
    // probe must never load twice.
    if (msg.viewUrl === viewUrl) {
      log.event("load_view.ignored", {
        data: { why: "duplicate", view: new URL(msg.viewUrl).host },
      });
      return false;
    }
    viewUrl = msg.viewUrl;
    if (askTimer) clearInterval(askTimer);
    askTimer = null;
    return true;
  };

  const loaded = (v: ReceiverView, tier: string, t0: number) => {
    deps.status(null);
    log.event("view.loaded", {
      durationMs: Date.now() - t0,
      data: { view: v.host, tier, sinceLaunchMs: Date.now() - deps.launchedAt },
    });
    fpsTimer ??= setInterval(logFps, FPS_EVERY_MS);
  };

  const notLoaded = (v: ReceiverView) => {
    deps.status("The TV page didn't load. Try casting again.");
    log.event("view.timeout", {
      level: "error",
      error: "the view didn't load",
      data: { view: v.host },
      now: true,
    });
  };

  const show = async (msg: z.infer<typeof LoadView>) => {
    if (!accept(msg)) return;
    const d = await measure();
    if (viewUrl !== msg.viewUrl) return; // a newer view arrived while the tier was measured
    const v = receiverView(msg.viewUrl, deps.origin, d.choice.tier);
    if (!v) return;
    const api = apiOrigin(msg.apiUrl) ?? v.api;
    if (api) log.setApi(api);
    log.event("load_view.received", {
      data: { view: v.host, launcher: v.launcher, tier: d.choice.tier },
    });
    const mine = { host: v.host, loaded: false };
    view = mine;
    const t0 = Date.now();
    deps.meter.drain();
    const result = await deps.frame.load(v.url);
    if (view !== mine) return;
    mine.loaded = result === "loaded";
    if (mine.loaded) loaded(v, d.choice.tier, t0);
    else notLoaded(v);
  };

  const state = () => ({
    type: "STATE",
    started: viewUrl !== null,
    view: view?.host ?? null,
    loaded: view?.loaded ?? false,
    ...detectedState(detected),
    fps: lastFps,
  });

  const onMessage = (data: unknown, reply: (m: object) => void) => {
    const load = LoadView.safeParse(data);
    if (load.success) {
      void show(load.data);
      return;
    }
    const typed = Typed.safeParse(data);
    if (typed.success && typed.data.type === "GET_STATE") reply(state());
    else if (typed.success && typed.data.type === "PEER_OFFER")
      reply({
        type: "PEER_ERROR",
        error: "This TV renders the launcher itself; it takes no peer stream",
      });
    else
      log.event("message.ignored", {
        level: "warn",
        data: { type: typed.success ? typed.data.type : typeof data },
      });
  };

  const onSenders = (s: "connected" | "disconnected", count: number) => {
    log.event("sender", { data: { state: s, count } });
    if (s === "connected") {
      if (noSenderTimer) clearTimeout(noSenderTimer);
      noSenderTimer = null;
      if (!viewUrl) ask();
    } else if (count === 0 && !noSenderTimer) {
      noSenderTimer = setTimeout(() => endCast("no phone connected for 20 min"), NO_SENDER_STOP_MS);
    }
  };

  return {
    start() {
      deps.status("Getting the TV ready");
      host.onMessage(onMessage);
      host.onSenders(onSenders);
      host.start();
      ask();
      askTimer = setInterval(ask, ASK_MS);
      setTimeout(() => endCast("the cast reached 3 hours"), MAX_CAST_MS);
      void measure().then((d) => {
        detected = d;
        log.event("tier", { durationMs: d.probeMs, data: tierData(d) });
        if (!viewUrl) deps.status("Waiting for the phone…");
      });
    },
    /** The cast is ending (the page is going): the last frame-rate summary. */
    finalFps: logFps,
  };
}
