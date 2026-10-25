import { z } from "zod";
import type { createFrameMeter, FrameStats } from "./frame-stats";
import type { RxLog } from "./rx-log";
import type { TierChoice, TierSignals } from "./tier";
import { receiverView } from "./view-url";

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
  attemptId: z.unknown().optional(),
  sessionId: z.unknown().optional(),
});
const Typed = z.object({ type: z.string() });

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

  const ask = () => host.broadcast({ type: "REQUEST_VIEW", accepts: ACCEPTS });

  const endCast = (why: string) => {
    if (ended) return;
    ended = true;
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

  const show = async (msg: z.infer<typeof LoadView>) => {
    log.join({ phoneAttemptId: msg.attemptId, sessionId: msg.sessionId });
    if (!receiverView(msg.viewUrl, deps.origin, "full")) {
      log.event("load_view.invalid", { level: "warn" });
      return;
    }
    // The phone repeats its view (on connect and on each REQUEST_VIEW): decided now, before the
    // tier is known, so a repeat sent during the probe never loads twice.
    if (msg.viewUrl === viewUrl) {
      log.event("load_view.ignored", {
        data: { why: "duplicate", view: new URL(msg.viewUrl).host },
      });
      return;
    }
    viewUrl = msg.viewUrl;
    if (askTimer) clearInterval(askTimer);
    askTimer = null;
    const d = await (detecting ??= deps.detect());
    if (viewUrl !== msg.viewUrl) return; // a newer view arrived while the tier was measured
    const v = receiverView(msg.viewUrl, deps.origin, d.choice.tier);
    if (!v) return;
    if (v.api) log.setApi(v.api);
    log.event("load_view.received", {
      data: { view: v.host, launcher: v.launcher, tier: d.choice.tier },
    });
    view = { host: v.host, loaded: false };
    const mine = view;
    const t0 = Date.now();
    deps.meter.drain();
    const result = await deps.frame.load(v.url);
    if (view !== mine) return;
    if (result === "loaded") {
      mine.loaded = true;
      deps.status(null);
      log.event("view.loaded", {
        durationMs: Date.now() - t0,
        data: { view: v.host, tier: d.choice.tier, sinceLaunchMs: Date.now() - deps.launchedAt },
      });
      fpsTimer ??= setInterval(logFps, FPS_EVERY_MS);
    } else {
      deps.status("The TV page didn't load. Try casting again.");
      log.event("view.timeout", {
        level: "error",
        error: "the view didn't load",
        data: { view: v.host },
        now: true,
      });
    }
  };

  const state = () => ({
    type: "STATE",
    started: viewUrl !== null,
    view: view?.host ?? null,
    loaded: view?.loaded ?? false,
    tier: detected?.choice.tier ?? null,
    reasons: detected?.choice.reasons ?? [],
    deviceClass: detected?.choice.deviceClass ?? null,
    gpu: detected?.signals.webgl?.renderer ?? null,
    probe: detected?.signals.frame ?? null,
    fps: lastFps,
    userAgent: detected?.signals.userAgent ?? null,
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
      detecting ??= deps.detect();
      void detecting.then((d) => {
        detected = d;
        const s = d.signals;
        log.event("tier", {
          durationMs: d.probeMs,
          data: {
            tier: d.choice.tier,
            reasons: d.choice.reasons.join(","),
            deviceClass: d.choice.deviceClass,
            gpu: s.webgl?.renderer.slice(0, 200) ?? null,
            maxTexture: s.webgl?.maxTextureSize ?? null,
            probeP50Ms: s.frame?.p50Ms ?? null,
            probeP90Ms: s.frame?.p90Ms ?? null,
            probeFrames: s.frame?.frames ?? null,
            memoryGb: s.deviceMemoryGb ?? null,
            heapLimitMb: s.heapLimitMb ?? null,
          },
        });
        if (!viewUrl) deps.status("Waiting for the phone…");
      });
    },
    /** The cast is ending (the page is going): the last frame-rate summary. */
    finalFps: logFps,
  };
}
