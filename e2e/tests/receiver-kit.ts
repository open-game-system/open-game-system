// The Cast receiver page (apps/web/public/receiver.html) in a real browser, with everything around
// it faked: the Google Cast receiver SDK (a stub with a test handle, window.__cast), the OGS API's
// client-events route (recorded, on any host), a laptop sender (another page, loopback WebRTC, so the
// receiver plays real frames) and a HUD page. Every other request is aborted and recorded in
// `blocked`, so no test reaches a real API or TURN, and a request to any renderer shows up there.
import { readFileSync } from "node:fs";
import { type Browser, surfaceOf } from "@e2e-dev/web";
import type { Page } from "playwright";
import { webEngine } from "../e2e.config";

export const ORIGIN = "https://receiver.ogs.test";
/** The OGS API a phone names in LOAD_VIEW (apiUrl). */
export const API = "https://api.ogs.test";
/** The receiver's own default API (production): its client-events route is answered here, never reached. */
export const DEFAULT_API = "https://opengame-api.jonathanrmumm.workers.dev";
export const HUD_URL = "https://hud.ogs.test/hud.html";
const CAST_SDK = "https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js";
const RECEIVER_FILE = new URL("../../apps/web/public/receiver.html", import.meta.url);
export const MIN = 60_000;

/**
 * Stand-in for the CAF receiver framework: one context whose messages and events the test drives
 * (`deliver`, `connect`, `disconnect`) and whose replies and stops it reads (`sent`, `stops`).
 */
const CAST_STUB = `(() => {
  const handlers = {}, listeners = {}, sent = [];
  let senders = [];
  const emit = (type, event) => (listeners[type] || []).forEach((fn) => fn(event));
  const state = window.__cast = {
    sent, stops: 0, started: false, idleTimeoutDisabled: null,
    deliver(data, senderId = 'phone') {
      (handlers['urn:x-cast:org.opengame.view'] || []).forEach((fn) => fn({ data, senderId }));
    },
    connect(senderId = 'phone') { senders.push(senderId); emit('senderconnected', { senderId }); },
    disconnect(senderId = 'phone') { senders = senders.filter((s) => s !== senderId); emit('senderdisconnected', { senderId }); },
  };
  const context = {
    addCustomMessageListener: (ns, fn) => (handlers[ns] = handlers[ns] || []).push(fn),
    sendCustomMessage: (ns, senderId, payload) => sent.push({ ns, to: senderId === undefined ? null : senderId, payload: JSON.parse(JSON.stringify(payload)) }),
    addEventListener: (type, fn) => (listeners[type] = listeners[type] || []).push(fn),
    getSenders: () => senders.map((id) => ({ id })),
    start: (options) => { state.started = true; state.idleTimeoutDisabled = !!options.disableIdleTimeout; },
    stop: () => { state.stops++; },
  };
  window.cast = { framework: {
    CastReceiverContext: { getInstance: () => context },
    CastReceiverOptions: function CastReceiverOptions() {},
    system: { MessageType: { JSON: 'JSON' }, EventType: { SENDER_CONNECTED: 'senderconnected', SENDER_DISCONNECTED: 'senderdisconnected' } },
  } };
})();`;

/** The game's HUD page: says HUD_READY, echoes every layout it gets, and shows the last one. */
const HUD_PAGE = `<!doctype html><html><body style="background:transparent;color:#fff">
<div id="hud-text">HUD waiting</div>
<script>
  addEventListener('message', (e) => {
    document.getElementById('hud-text').textContent = 'HUD score ' + e.data.score;
    parent.postMessage({ type: 'HUD_SHOWING', score: e.data.score }, '*');
  });
  parent.postMessage({ type: 'HUD_READY' }, '*');
</script></body></html>`;

const BLANK = "<!doctype html><html><body></body></html>";

/** The OGS TV receiver the Cast receiver frames for a phone's view (apps/tv/receiver.html). */
export const TV_RECEIVER = "https://ogs-tv.pages.dev/receiver.html";
/**
 * Stand-in for it: says ready to its parent, keeps every relayed message (window.__got), answers
 * GET_STATE for the sender that asked, and stops the cast when the test calls window.__stop().
 */
const TV_RECEIVER_STUB = `<!doctype html><html><body style="margin:0;background:#123;color:#fff">
<div id="local">local TV receiver</div>
<script>
  window.__got = [];
  const parentOrigin = location.ancestorOrigins[0];
  addEventListener('message', (e) => {
    if (e.source !== parent || !e.data || e.data.ogsRx !== 'in') return;
    window.__got.push(e.data);
    if (e.data.data && e.data.data.type === 'GET_STATE')
      parent.postMessage({ ogsRx: 'out', to: e.data.senderId, data: { type: 'STATE', local: true, tier: 'lite' } }, parentOrigin);
  });
  window.__stop = () => parent.postMessage({ ogsRx: 'stop' }, parentOrigin);
  parent.postMessage({ ogsRx: 'ready' }, parentOrigin);
</script></body></html>`;

/**
 * How the fake Screen Wake Lock API behaves: grants each request, rejects each (NotAllowedError,
 * as a device that won't keep its screen on), or is missing from navigator.
 */
export type WakeLockMode = "grant" | "reject" | "missing";

/**
 * Stand-in for navigator.wakeLock and document.visibilityState on the receiver page, with a test
 * handle (window.__wakeLock): every request, the locks held, the ones the page released, and the
 * system's moves (`lose`: it drops the lock; `setVisibility`: the page hides or shows, and a hidden
 * page loses its lock, as the spec says).
 */
const WAKE_LOCK_STUB = (mode: WakeLockMode) => `(() => {
  if (location.pathname !== '/receiver.html') return;
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility !== 'visible' });
  const state = window.__wakeLock = {
    mode: ${JSON.stringify(mode)}, requests: [], held: [], releasedByPage: 0,
    lose() { state.held.slice().forEach((s) => s.drop()); },
    setVisibility(v) {
      visibility = v;
      if (v !== 'visible') state.lose();
      document.dispatchEvent(new Event('visibilitychange'));
    },
  };
  class WakeLockSentinel extends EventTarget {
    constructor() { super(); this.type = 'screen'; this.released = false; }
    drop() {
      if (this.released) return;
      this.released = true;
      state.held = state.held.filter((s) => s !== this);
      this.dispatchEvent(new Event('release'));
    }
    release() { if (!this.released) state.releasedByPage++; this.drop(); return Promise.resolve(); }
  }
  if (state.mode === 'missing') {
    delete Navigator.prototype.wakeLock;
    return;
  }
  const wakeLock = {
    request(type) {
      state.requests.push(type);
      if (state.mode === 'reject') return Promise.reject(new DOMException('Wake Lock permission request denied', 'NotAllowedError'));
      if (visibility !== 'visible') return Promise.reject(new DOMException('The requesting page is not visible', 'NotAllowedError'));
      const sentinel = new WakeLockSentinel();
      state.held.push(sentinel);
      return Promise.resolve(sentinel);
    },
  };
  Object.defineProperty(Navigator.prototype, 'wakeLock', { configurable: true, get: () => wakeLock });
})();`;

/** The receiver's keep-awake clips (apps/web/public), served at the receiver's origin. */
const KEEP_AWAKE: Record<string, { file: string; type: string }> = {
  [`${ORIGIN}/keepawake.mp4`]: { file: "keepawake.mp4", type: "video/mp4" },
  [`${ORIGIN}/keepawake.webm`]: { file: "keepawake.webm", type: "video/webm" },
};
const PUBLIC_DIR = new URL("../../apps/web/public/", import.meta.url);

/** A message the receiver sent through the Cast context: `to` null = every sender. */
export interface Sent {
  ns: string;
  to: string | null;
  payload: { type: string; [key: string]: unknown };
}

declare global {
  interface Window {
    __cast: {
      sent: Sent[];
      stops: number;
      started: boolean;
      idleTimeoutDisabled: boolean | null;
      deliver: (data: unknown, senderId?: string) => void;
      connect: (senderId?: string) => void;
      disconnect: (senderId?: string) => void;
    };
    peer: RTCPeerConnection;
    offerPeer: () => Promise<string>;
    __wakeLock: {
      mode: WakeLockMode;
      /** Every navigator.wakeLock.request(type), in order. */
      requests: string[];
      /** Locks granted and not yet released (by the page or the system). */
      held: unknown[];
      /** Locks the page released itself (sentinel.release()). */
      releasedByPage: number;
      /** The system drops every lock it holds (each sentinel's "release" event). */
      lose: () => void;
      /** The page is hidden or shown (visibilitychange); a hidden page loses its lock. */
      setVisibility: (state: "visible" | "hidden") => void;
    };
    acceptAnswer: (sdp: string) => Promise<void>;
  }
}

/**
 * A page that publishes a moving canvas over WebRTC: a laptop sender.
 * `offerPeer()` makes a fresh connection and returns its complete offer (host candidates only:
 * both pages run in this browser, so loopback ICE connects with no STUN or TURN).
 */
async function publisher(page: Page): Promise<void> {
  await page.goto(`${ORIGIN}/blank`);
  await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    let hue = 0;
    setInterval(() => {
      hue = (hue + 7) % 360;
      if (!ctx) return;
      ctx.fillStyle = `hsl(${hue} 70% 50%)`;
      ctx.fillRect(0, 0, 640, 360);
    }, 33);
    const gathered = (pc: RTCPeerConnection) =>
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        pc.addEventListener("icegatheringstatechange", () => {
          if (pc.iceGatheringState === "complete") resolve();
        });
      });
    window.offerPeer = async () => {
      const pc = new RTCPeerConnection();
      window.peer = pc;
      for (const track of canvas.captureStream(30).getTracks()) pc.addTrack(track);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      return pc.localDescription?.sdp ?? "";
    };
    window.acceptAnswer = (sdp: string) =>
      window.peer.setRemoteDescription({ type: "answer", sdp });
  });
}

export interface ClientEventPost {
  url: string;
  authorization: string | undefined;
  body: unknown;
}

export interface Receiver {
  page: Page;
  /** Requests the harness refused (anything not faked here). Must stay empty. */
  blocked: string[];
  /** The receiver's POSTs to /api/v1/client-events (its wide events), in order. */
  events: ClientEventPost[];
  /** Creates the second page: a laptop sender. */
  publisherPage: () => Promise<Page>;
  sent: () => Promise<Sent[]>;
  ofType: (type: string) => Promise<Sent[]>;
  deliver: (data: unknown, senderId?: string) => Promise<void>;
  connect: (senderId?: string) => Promise<void>;
  disconnect: (senderId?: string) => Promise<void>;
  stops: () => Promise<number>;
  status: () => Promise<{ text: string; overlay: boolean; spinner: boolean }>;
  /** The framed OGS TV receiver: its URL (null: none), and the messages relayed to it. */
  local: () => Promise<{
    src: string | null;
    got: { senderId: string; data: { type: string; [k: string]: unknown } }[];
  }>;
  /** The TV receiver asks to end the cast. */
  localStop: () => Promise<void>;
  /** Resolves with the size of the next frame the <video> presents (requestVideoFrameCallback). */
  nextFrame: () => Promise<{ width: number; height: number }>;
}

/**
 * Opens the receiver page with `query`, every dependency faked. `clock`: Playwright's virtual clock.
 * `wakeLock`: how the fake Screen Wake Lock API answers (default: it grants every request).
 */
export async function openReceiver(
  browser: Browser,
  {
    query = "",
    clock = false,
    wakeLock = "grant",
  }: { query?: string; clock?: boolean; wakeLock?: WakeLockMode } = {},
): Promise<Receiver> {
  const blocked: string[] = [];
  const events: ClientEventPost[] = [];
  const live = surfaceOf(webEngine);
  if (!live) throw new Error("the web engine is not the one the runner drives (see e2e.config.ts)");

  await browser.route("**/*", async (route) => {
    const url = route.request.url;
    // The receiver's wide events (POST /api/v1/client-events on the API it logs to): recorded.
    if (new URL(url).pathname === "/api/v1/client-events") {
      const { method, headers, postData } = route.request;
      if (method === "POST")
        events.push({
          url,
          authorization: headers.authorization,
          body: postData ? JSON.parse(postData) : undefined,
        });
      return route.fulfill({ status: method === "POST" ? 202 : 204, json: { accepted: 1 } });
    }
    if (url === CAST_SDK)
      return route.fulfill({ headers: { "content-type": "text/javascript" }, body: CAST_STUB });
    if (url.startsWith(`${ORIGIN}/receiver.html`))
      return route.fulfill({
        headers: { "content-type": "text/html" },
        body: readFileSync(RECEIVER_FILE, "utf8"),
      });
    if (url.startsWith(`${TV_RECEIVER}?`))
      return route.fulfill({ headers: { "content-type": "text/html" }, body: TV_RECEIVER_STUB });
    if (url === `${ORIGIN}/blank`)
      return route.fulfill({ headers: { "content-type": "text/html" }, body: BLANK });
    if (url === HUD_URL)
      return route.fulfill({ headers: { "content-type": "text/html" }, body: HUD_PAGE });
    const clip = KEEP_AWAKE[url];
    if (clip)
      return route.fulfill({
        headers: { "content-type": clip.type },
        body: readFileSync(new URL(clip.file, PUBLIC_DIR)),
      });
    blocked.push(url);
    return route.abort();
  });

  async function publisherPage(): Promise<Page> {
    const page = await live!.context().newPage();
    await publisher(page);
    return page;
  }

  await browser.goto(`${ORIGIN}/blank`);
  const page = live.page();
  // tsx (esbuild keepNames) wraps named functions in the test's page callbacks with __name().
  await live.context().addInitScript("globalThis.__name = (fn) => fn;");
  await page.addInitScript(WAKE_LOCK_STUB(wakeLock));
  if (clock) await page.clock.install();
  await browser.goto(`${ORIGIN}/receiver.html${query}`);

  const sent = () => page.evaluate(() => window.__cast?.sent ?? []);
  return {
    page,
    blocked,
    events,
    publisherPage,
    sent,
    ofType: async (type) => (await sent()).filter((m) => m.payload.type === type),
    deliver: (data, senderId) =>
      page.evaluate(([d, s]) => window.__cast.deliver(d, s), [data, senderId] as const),
    connect: (senderId) => page.evaluate((s) => window.__cast.connect(s), senderId),
    disconnect: (senderId) => page.evaluate((s) => window.__cast.disconnect(s), senderId),
    stops: () => page.evaluate(() => window.__cast.stops),
    local: async () => {
      const src = await page.evaluate(
        () => document.getElementById("local-view")?.getAttribute("src") ?? null,
      );
      const frame = page.frames().find((f) => f.url().startsWith(TV_RECEIVER));
      const got =
        frame && src ? await frame.evaluate(() => (window as unknown as { __got: [] }).__got) : [];
      return { src, got };
    },
    localStop: async () => {
      const frame = page.frames().find((f) => f.url().startsWith(TV_RECEIVER));
      await frame?.evaluate(() => (window as unknown as { __stop: () => void }).__stop());
    },
    status: () =>
      page.evaluate(() => ({
        text: document.getElementById("status-text")?.textContent ?? "",
        overlay: !document.getElementById("status-overlay")?.classList.contains("hidden"),
        spinner: document.getElementById("spinner")?.style.display !== "none",
      })),
    nextFrame: () =>
      within(
        10_000,
        "a video frame",
        page.evaluate(
          () =>
            new Promise<{ width: number; height: number }>((resolve) => {
              const video = document.querySelector("video");
              video?.requestVideoFrameCallback((_now, meta) =>
                resolve({ width: meta.width, height: meta.height }),
              );
            }),
        ),
      ),
  };
}

/**
 * A laptop casts its tab: it offers, the receiver answers over Cast, and the picture plays. Resolves
 * once the receiver's <video> presents a frame.
 */
export async function laptopPlaying(rx: Receiver): Promise<Page> {
  const laptop = await rx.publisherPage();
  const sdp = await laptop.evaluate(() => window.offerPeer());
  await rx.deliver({ type: "PEER_OFFER", sdp, iceServers: [] }, "laptop");
  const [answer] = await until(async () => {
    const all = await rx.ofType("PEER_ANSWER");
    return all.length > 0 && all;
  }, "PEER_ANSWER");
  await laptop.evaluate((s) => window.acceptAnswer(s), String(answer.payload.sdp));
  await rx.nextFrame();
  return laptop;
}

type Truthy<T> = Exclude<T, false | 0 | "" | null | undefined>;
const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);

/** Polls `read` until it returns a truthy value (real time, not the page's clock). */
export async function until<T>(
  read: () => Promise<T> | T,
  what: string,
  timeoutMs = 10_000,
): Promise<Truthy<T>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (isTruthy(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** `promise`, or a failure naming `what` after `ms` of real time. */
export function within<T>(ms: number, what: string, promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
