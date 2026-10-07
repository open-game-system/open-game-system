// The cloud stream end to end on this machine (acceptance:
// docs/acceptance/2026-10-06-stream-full-pipe.feature): the real renderer
// (services/api/container/src/server.ts, local Chrome + capture extension, no GPU) renders a local
// view page and publishes its tab over WebRTC to the real TV receiver (receiver.html, Cast stubbed).
// Default: the SFU is a loopback stand-in (renderer offer → receiver, answer → renderer), nothing
// leaves this machine. OGS_E2E_SFU=1: the API's own stream routes run against Cloudflare Realtime +
// TURN (credentials from the environment only; skipped when absent). Each test kills what it
// started in `finally` and checks nothing of the renderer is still running.
import { writeFileSync } from "node:fs";
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { MIN, openReceiver, type Receiver, STREAM, until, within } from "./receiver-kit";
import {
  HARD_LIMIT_MS,
  leftovers,
  loopbackStreamServer,
  missingSfuEnv,
  type Renderer,
  sfuStreamServer,
  startRenderer,
  startViewServer,
  type ViewServer,
} from "./renderer-kit";

declare global {
  interface Window {
    /** The receiver's peer connection (receiver.html exposes it for stream checks). */
    receiverPc?: RTCPeerConnection;
  }
}

const ENDED = "This TV session has ended";
/** The renderer's idle limit in these runs (production: 20 min). */
const IDLE_MS = 4000;

interface Pipe {
  rx: Receiver;
  renderer: Renderer;
  view: ViewServer;
  /** HTTP status of each heartbeat answer (the API's route → the renderer's /ping), in order. */
  heartbeats: number[];
}

/**
 * Starts the renderer and the view page, opens the receiver with `serve` as its stream server, runs
 * `body`, then stops everything, whatever happened, and checks nothing is left.
 */
async function withPipe(
  browser: Parameters<typeof openReceiver>[0],
  {
    clock = false,
    sfu = false,
    env = {},
  }: { clock?: boolean; sfu?: boolean; env?: Record<string, string> },
  body: (pipe: Pipe) => Promise<void>,
) {
  let renderer: Renderer | null = null;
  let view: ViewServer | null = null;
  try {
    renderer = await startRenderer({ STREAM_IDLE_MS: String(IDLE_MS), ...env });
    view = await startViewServer();
    const rx = await openReceiver(browser, { clock });
    const serve = sfu ? sfuStreamServer(renderer) : loopbackStreamServer(renderer);
    const heartbeats: number[] = [];
    rx.stream.handle = async (call) => {
      const reply = await serve(call);
      if (call.path === "/heartbeat" && reply) heartbeats.push(reply.status);
      return reply;
    };
    await within(HARD_LIMIT_MS - 10_000, "the pipe test", body({ rx, renderer, view, heartbeats }));
  } catch (error) {
    // The renderer's own trace, to see where it stopped (never under the SFU: its log may carry TURN details).
    if (renderer && !sfu) {
      const file = new URL("../.e2e/renderer.log", import.meta.url);
      writeFileSync(file, renderer.log.join("\n"));
      console.log(`${renderer.log.slice(-40).join("\n")}\n(whole renderer log: ${file.pathname})`);
    }
    throw error;
  } finally {
    await renderer?.stop();
    await view?.close();
    expect(leftovers()).toEqual([]);
  }
}

/** A phone casts the view page; resolves once the receiver plays a frame of it. */
async function cast(rx: Receiver, view: ViewServer) {
  await rx.connect("phone");
  await rx.deliver({ type: "LOAD_VIEW", viewUrl: view.url, streamServerUrl: STREAM }, "phone");
  const playing = () =>
    rx.page.evaluate(() => {
      const video = document.querySelector("video");
      return video !== null && video.videoWidth > 0 && video.readyState >= 2;
    });
  await until(playing, "the first frame of the renderer's picture", 60_000);
}

/** Frames decoded so far by the receiver's video (its inbound RTP). */
async function framesDecoded(rx: Receiver): Promise<number> {
  return rx.page.evaluate(async () => {
    let frames = 0;
    (await window.receiverPc?.getStats())?.forEach((r) => {
      if (r.type === "inbound-rtp" && r.kind === "video") frames = r.framesDecoded;
    });
    return frames;
  });
}

/** The video's current picture, 32x18, as RGB bytes. */
function pixels(rx: Receiver): Promise<number[]> {
  return rx.page.evaluate(() => {
    const video = document.querySelector("video");
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext("2d");
    if (!video || !ctx) return [];
    ctx.drawImage(video, 0, 0, 32, 18);
    const data = ctx.getImageData(0, 0, 32, 18).data;
    const rgb: number[] = [];
    for (let i = 0; i < data.length; i += 4) rgb.push(data[i], data[i + 1], data[i + 2]);
    return rgb;
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const difference = (a: number[], b: number[]) => mean(a.map((x, i) => Math.abs(x - (b[i] ?? 0))));

/** Real, changing frames: the decoded count grows and two pictures 600 ms apart differ. */
async function expectMovingPicture(rx: Receiver) {
  const size = await rx.nextFrame();
  expect(size.width).toBeGreaterThan(0);
  expect(size.width / size.height).toBeCloseTo(16 / 9, 1);
  const before = await framesDecoded(rx);
  const first = await pixels(rx);
  await new Promise((r) => setTimeout(r, 600));
  const second = await pixels(rx);
  await new Promise((r) => setTimeout(r, 1400));
  const after = await framesDecoded(rx);
  expect(after - before).toBeGreaterThan(10); // the page animates at 60 fps; capture is up to 30
  expect(mean(first)).toBeGreaterThan(40); // the page's colours, not a black screen
  expect(difference(first, second)).toBeGreaterThan(5);
}

describe("Stream full pipe: local renderer → WebRTC → TV receiver", {
  tags: ["receiver", "pipe"],
  requires: ["browser"],
}, () => {
  test("the renderer's picture reaches the TV and moves", { timeout: HARD_LIMIT_MS }, async ({
    browser,
  }) => {
    await withPipe(browser, {}, async ({ rx, view }) => {
      await cast(rx, view);
      await expectMovingPicture(rx);
      expect((await rx.status()).overlay).toBe(false);
      expect(rx.callsTo("/start-stream")[0]?.body).toEqual({ url: view.url });
      expect(rx.blocked).toEqual([]);
    });
  });

  test("player activity keeps the stream; none for the idle limit ends it (renderer /ping)", {
    timeout: HARD_LIMIT_MS,
  }, async ({ browser, screen }) => {
    await withPipe(browser, { clock: true }, async ({ rx, renderer, view, heartbeats }) => {
      await cast(rx, view);
      // Active past the idle limit: the heartbeat (the API's route → the renderer's /ping) is answered.
      await new Promise((r) => setTimeout(r, IDLE_MS + 1000));
      await rx.page.clock.fastForward(MIN);
      await until(() => heartbeats.length >= 1, "the first heartbeat");
      expect(heartbeats).toEqual([200]);
      await new Promise((r) => setTimeout(r, 500));
      expect(await rx.stops()).toBe(0);
      expect((await renderer.health()).browserActive).toBe(true);
      await expectMovingPicture(rx);

      // Nobody plays (the page keeps animating): past the idle limit the renderer ends the stream.
      view.setActive(false);
      await new Promise((r) => setTimeout(r, IDLE_MS + 1500));
      await rx.page.clock.fastForward(MIN);
      await until(() => rx.stops(), "the receiver to stop the Cast app", 15_000);
      await expect(screen.getByText(ENDED)).toBeVisible();
      expect(heartbeats).toEqual([200, 410]);
      expect(renderer.log.some((l) => l.includes("No player activity for too long"))).toBe(true);
      expect((await renderer.health()).browserActive).toBe(false);

      // The instance outlives the idle stop (a warm Cloud Run instance): the next cast relaunches Chrome.
      const again = await fetch(`${renderer.url}/publisher/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: view.url, iceServers: [] }),
      });
      expect(again.status).toBe(200);
      expect((await renderer.health()).browserActive).toBe(true);
    });
  });

  // Regression: a relaunched Chrome loaded the extension page without chrome.tabs/tabCapture on ~30%
  // of relaunches, and that cast failed (prepare 500, "reading 'query'"). Eight stop/relaunch cycles.
  test("a warm renderer serves every next cast after a stop (Chrome relaunch)", {
    timeout: HARD_LIMIT_MS,
  }, async ({ browser }) => {
    await withPipe(browser, { env: { STREAM_MAX_MS: "1" } }, async ({ renderer, view }) => {
      const statuses: string[] = [];
      for (let cycle = 0; cycle < 8; cycle++) {
        const prepared = await fetch(`${renderer.url}/publisher/prepare`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: view.url, iceServers: [] }),
          signal: AbortSignal.timeout(30_000),
        });
        // STREAM_MAX_MS=1: the next heartbeat finds the stream past its lifetime and closes Chrome.
        const ping = await fetch(`${renderer.url}/ping`);
        statuses.push(`${prepared.status}/${ping.status}`);
      }
      expect(statuses).toEqual(Array(8).fill("200/410"));
    });
  });

  test("through Cloudflare Realtime + TURN (OGS_E2E_SFU=1)", { timeout: HARD_LIMIT_MS }, async ({
    browser,
  }) => {
    test.skip(process.env.OGS_E2E_SFU !== "1", "OGS_E2E_SFU is not 1: the SFU leg is opt-in");
    const missing = missingSfuEnv();
    test.skip(missing.length > 0, `OGS_E2E_SFU=1 but not set: ${missing.join(", ")}`);
    await withPipe(browser, { sfu: true }, async ({ rx, view }) => {
      await cast(rx, view);
      await expectMovingPicture(rx);
    });
  });
});
