import { RenderTierSchema } from "@open-game-system/ogs-protocol";
import { type CafNamespace, cafHost, parentHost, type ReceiverHost, relayHost } from "./cast-host";
import { createFrameMeter } from "./frame-stats";
import { keepAwake } from "./keep-awake";
import { measureTv } from "./probe";
import { createReceiver, type ViewFrame } from "./receiver";
import { createRxLog } from "./rx-log";
import { deviceClassOf } from "./tier";

declare global {
  interface Window {
    /** CAF (cast_receiver_framework.js), on a Cast device. */
    cast?: CafNamespace;
    __ogsSignalIn?: (data: unknown) => void;
    __ogsSignalOut?: (data: unknown) => void;
  }
}

const RX_VERSION = "receiver-local-2026-10-25";
/** How long the launcher may take to load before the TV says it didn't. */
const VIEW_LOAD_TIMEOUT_MS = 30_000;

const q = new URLSearchParams(window.location.search);
const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const iframe = document.getElementById("view");

const status = (text: string | null) => {
  if (!statusEl || !statusText) return;
  statusEl.dataset.hidden = text === null ? "1" : "0";
  if (text !== null) statusText.textContent = text;
};

/**
 * Who speaks Cast for this page: the OGS Cast receiver page framing it (host=parent: it owns CAF),
 * CAF itself (this page registered as the Cast app's URL), or a test relay (signal=test).
 */
function pickHost(): ReceiverHost | null {
  if (q.get("signal") === "test") return relayHost(window);
  if (q.get("host") === "parent" && window.parent !== window) return parentHost(window);
  return window.cast?.framework ? cafHost(window.cast) : null;
}
const host = pickHost();

if (!host || !(iframe instanceof HTMLIFrameElement)) {
  status("Cast to this TV from the OGS app");
} else {
  const run = `rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const log = createRxLog({
    post: (url, body) => {
      void fetch(url, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body,
      }).catch(() => {});
    },
    run,
    version: RX_VERSION,
    platform: deviceClassOf(navigator.userAgent),
  });
  log.event("launched", {
    data: { version: RX_VERSION, sinceStartMs: Math.round(performance.now()) },
  });
  window.addEventListener("error", (e) =>
    log.event("error", { error: e.error ?? e.message, data: { where: "receiver" }, now: true }),
  );
  window.addEventListener("unhandledrejection", (e) =>
    log.event("error", { error: e.reason, data: { where: "receiver.promise" }, now: true }),
  );

  const meter = createFrameMeter();
  const loop = (t: number) => {
    meter.tick(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") meter.pause();
    log.event("visibility", {
      data: { state: document.visibilityState },
      now: document.visibilityState !== "visible",
    });
  });

  const frame: ViewFrame = {
    load: (url) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), VIEW_LOAD_TIMEOUT_MS);
        iframe.onload = () => {
          clearTimeout(timer);
          iframe.dataset.loaded = "1";
          // The launcher is on this site: its uncaught errors are the receiver's to log too.
          try {
            iframe.contentWindow?.addEventListener("error", (e) =>
              log.event("error", {
                error: e.error ?? e.message,
                data: { where: "launcher" },
                now: true,
              }),
            );
          } catch {
            /* another origin: its errors stay its own */
          }
          resolve("loaded");
        };
        iframe.dataset.loaded = "0";
        iframe.src = url;
      }),
  };

  const override = RenderTierSchema.safeParse(q.get("tier"));
  const rx = createReceiver({
    host,
    frame,
    status,
    log,
    detect: () =>
      measureTv({ uhd: host.uhd(), ...(override.success ? { override: override.data } : {}) }),
    origin: window.location.origin,
    meter,
    launchedAt: performance.timeOrigin,
  });
  rx.start();
  keepAwake(log);
  window.addEventListener("pagehide", () => {
    rx.finalFps();
    log.event("visibility", { data: { state: "pagehide" }, now: true });
    log.flush();
  });
}
