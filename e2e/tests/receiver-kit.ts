// The Cast receiver page (apps/web/public/receiver.html) in a real browser, with everything around
// it faked: the Google Cast receiver SDK (a stub with a test handle, window.__cast), the stream
// server (Node answers every route; its "SFU" is a real RTCPeerConnection in a second page, so the
// receiver plays real frames), a laptop sender (another page, loopback WebRTC) and a HUD page.
// Every other request is aborted and recorded, so no test reaches a real API, TURN or GPU.
import { readFileSync } from "node:fs";
import { type Browser, surfaceOf, type WebRoute } from "@e2e-dev/web";
import type { Page } from "playwright";
import { z } from "zod";
import { webEngine } from "../e2e.config";

export const ORIGIN = "https://receiver.ogs.test";
export const STREAM = "https://stream.ogs.test/api/v1/stream";
export const OTHER_STREAM = "https://stream-two.ogs.test/api/v1/stream";
/** The receiver's own default stream server (production): answered here by the mock, never reached. */
export const DEFAULT_STREAM = "https://opengame-api.jonathanrmumm.workers.dev/api/v1/stream";
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

/** A message the receiver sent through the Cast context: `to` null = every sender. */
export interface Sent {
  ns: string;
  to: string | null;
  payload: { type: string; [key: string]: unknown };
}

/** One request to a (mock) stream server. */
export interface StreamCall {
  base: string;
  path: string;
  method: string;
  session: string | undefined;
  body: unknown;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Reply = { status: number; json: Json };

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
    acceptAnswer: (sdp: string) => Promise<void>;
  }
}

/**
 * A page that publishes a moving canvas over WebRTC: the stream server's SFU or a laptop sender.
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

export interface StreamServer {
  calls: StreamCall[];
  /** What start-stream answers (default: success, publisher pub-1). */
  start: () => Reply;
  /** What each heartbeat answers (default: 200 pong). */
  heartbeat: (call: StreamCall) => Reply;
  /** What subscribe answers when not the default (the SFU's real offer). */
  subscribe: (() => Reply) | null;
}

export interface ClientEventPost {
  url: string;
  authorization: string | undefined;
  body: unknown;
}

export interface Receiver {
  page: Page;
  stream: StreamServer;
  /** Requests the harness refused (anything not faked here). Must stay empty. */
  blocked: string[];
  /** The receiver's POSTs to /api/v1/client-events (its wide events), in order. */
  events: ClientEventPost[];
  /** Creates the second page: the SFU behind the mock stream server, or a laptop sender. */
  publisherPage: () => Promise<Page>;
  sent: () => Promise<Sent[]>;
  ofType: (type: string) => Promise<Sent[]>;
  deliver: (data: unknown, senderId?: string) => Promise<void>;
  connect: (senderId?: string) => Promise<void>;
  disconnect: (senderId?: string) => Promise<void>;
  stops: () => Promise<number>;
  status: () => Promise<{ text: string; overlay: boolean; spinner: boolean }>;
  /** Resolves with the size of the next frame the <video> presents (requestVideoFrameCallback). */
  nextFrame: () => Promise<{ width: number; height: number }>;
  callsTo: (path: string) => StreamCall[];
}

const AnswerBody = z.object({
  sessionDescription: z.object({ type: z.literal("answer"), sdp: z.string() }),
});

const STREAM_BASES = [STREAM, OTHER_STREAM, DEFAULT_STREAM];

/** Opens the receiver page with `query`, every dependency faked. `clock`: Playwright's virtual clock. */
export async function openReceiver(
  browser: Browser,
  { query = "", clock = false }: { query?: string; clock?: boolean } = {},
): Promise<Receiver> {
  const blocked: string[] = [];
  const events: ClientEventPost[] = [];
  let sfu: Page | null = null;
  const stream: StreamServer = {
    calls: [],
    start: () => ({
      status: 200,
      json: { status: "success", publisherSessionId: "pub-1", traceId: "t" },
    }),
    heartbeat: () => ({ status: 200, json: { ok: true } }),
    subscribe: null,
  };
  const live = surfaceOf(webEngine);
  if (!live) throw new Error("the web engine is not the one the runner drives (see e2e.config.ts)");

  async function streamReply(base: string, route: WebRoute): Promise<Reply> {
    const { url, method, headers, postData } = route.request;
    const path = url.slice(base.length);
    const call: StreamCall = {
      base,
      path,
      method,
      session: headers["x-stream-session-id"],
      body: postData ? JSON.parse(postData) : undefined,
    };
    stream.calls.push(call);
    if (path === "/ice-servers")
      return { status: 200, json: { iceServers: [], traceId: "t", sessionId: null } };
    if (path === "/start-stream") return stream.start();
    if (path === "/heartbeat") return stream.heartbeat(call);
    if (path === "/subscribe") {
      if (stream.subscribe) return stream.subscribe();
      sfu ??= await publisherPage();
      const sdp = await sfu.evaluate(() => window.offerPeer());
      return {
        status: 200,
        json: {
          subscriberSessionId: "sub-1",
          sessionDescription: { type: "offer", sdp },
          traceId: "t",
        },
      };
    }
    if (path === "/subscribe/sub-1/answer" && sfu) {
      const answer = AnswerBody.parse(call.body);
      await sfu.evaluate((sdp) => window.acceptAnswer(sdp), answer.sessionDescription.sdp);
      return { status: 200, json: { status: "success", traceId: "t" } };
    }
    return { status: 404, json: { error: { code: "not_found", message: path, status: 404 } } };
  }

  await browser.route("**/*", async (route) => {
    const url = route.request.url;
    // The receiver's wide events (POST /api/v1/client-events on its stream server's API): recorded.
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
    const base = STREAM_BASES.find((b) => url.startsWith(`${b}/`));
    if (base) {
      const reply = await streamReply(base, route);
      return route.fulfill({ status: reply.status, json: reply.json });
    }
    if (url === CAST_SDK)
      return route.fulfill({ headers: { "content-type": "text/javascript" }, body: CAST_STUB });
    if (url.startsWith(`${ORIGIN}/receiver.html`))
      return route.fulfill({
        headers: { "content-type": "text/html" },
        body: readFileSync(RECEIVER_FILE, "utf8"),
      });
    if (url === `${ORIGIN}/blank`)
      return route.fulfill({ headers: { "content-type": "text/html" }, body: BLANK });
    if (url === HUD_URL)
      return route.fulfill({ headers: { "content-type": "text/html" }, body: HUD_PAGE });
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
  if (clock) await page.clock.install();
  await browser.goto(`${ORIGIN}/receiver.html${query}`);

  const sent = () => page.evaluate(() => window.__cast?.sent ?? []);
  return {
    page,
    stream,
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
    callsTo: (path) => stream.calls.filter((c) => c.path === path),
  };
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
