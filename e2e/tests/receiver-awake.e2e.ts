// The TV stays awake while a stream plays (acceptance: docs/acceptance/2026-10-04-cast-receiver-e2e.feature,
// "Keep the TV awake"). Owner, 2026-10-10: Google TV's screensaver took over a few minutes into a
// game. The stream is WebRTC in a plain <video>, which doesn't count as media playing, so the
// receiver holds a Screen Wake Lock while it plays (re-taken when the system drops it or the page
// shows again), falls back to a tiny looping muted clip when there is no wake lock, lets both go
// when the cast stops, and logs every step (receiver.keepawake, receiver.visibility).
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import type { Page } from "playwright";
import { z } from "zod";
import { MIN, openReceiver, type Receiver, STREAM, until } from "./receiver-kit";

const VIEW = "https://game.ogs.test/tv?room=ABCD";

const Batch = z.object({
  events: z.array(
    z.object({
      name: z.string(),
      level: z.string(),
      error: z.string().optional(),
      data: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional(),
    }),
  ),
});
const named = (rx: Receiver, name: string) =>
  rx.events.flatMap((post) => Batch.parse(post.body).events).filter((e) => e.name === name);
/** Waits for the receiver's batched events (sent every 3 s) to include `name` matching `data`. */
const loggedEvent = (rx: Receiver, name: string, data: Record<string, unknown>) =>
  until(
    () =>
      named(rx, name).find((e) =>
        Object.entries(data).every(([k, v]) => e.data && e.data[k] === v),
      ),
    `${name} ${JSON.stringify(data)} logged`,
  );

const wake = (page: Page) =>
  page.evaluate(() => ({
    requests: window.__wakeLock.requests.slice(),
    held: window.__wakeLock.held.length,
    releasedByPage: window.__wakeLock.releasedByPage,
  }));
/** The keep-awake clip: null until the receiver makes one. */
const clip = (page: Page) =>
  page.evaluate(() => {
    const v = document.getElementById("keepawake");
    if (!(v instanceof HTMLVideoElement)) return null;
    return {
      paused: v.paused,
      time: v.currentTime,
      muted: v.muted,
      loop: v.loop,
      playsInline: v.playsInline,
    };
  });

async function playPhoneView(rx: Receiver) {
  await rx.connect("phone");
  await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM }, "phone");
  await rx.nextFrame();
}

describe("TV receiver keeps the TV awake while it plays", {
  tags: ["receiver"],
  requires: ["browser"],
}, () => {
  test("takes a screen wake lock once the phone's stream plays, not before", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await new Promise((r) => setTimeout(r, 300));
    expect((await wake(rx.page)).requests).toEqual([]);
    await playPhoneView(rx);
    await until(async () => (await wake(rx.page)).held === 1, "a wake lock held");
    expect((await wake(rx.page)).requests).toEqual(["screen"]);
    // A wake lock is enough: no keep-awake clip.
    expect(await clip(rx.page)).toBe(null);
    const ok = await loggedEvent(rx, "receiver.keepawake", { method: "wakeLock", ok: true });
    expect(ok.level).toBe("info");
    expect(rx.blocked).toEqual([]);
  });

  test("takes it again when the system drops it, and when the page shows again", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await playPhoneView(rx);
    await until(async () => (await wake(rx.page)).held === 1, "a wake lock held");
    await rx.page.evaluate(() => window.__wakeLock.lose());
    await until(async () => (await wake(rx.page)).requests.length === 2, "a second request");
    await until(async () => (await wake(rx.page)).held === 1, "the lock held again");
    await loggedEvent(rx, "receiver.keepawake", { method: "wakeLock", step: "lost" });

    // Hidden (a screensaver over the page): the lock goes and can't be had; shown: taken again.
    await rx.page.evaluate(() => window.__wakeLock.setVisibility("hidden"));
    await loggedEvent(rx, "receiver.visibility", { state: "hidden" });
    const whileHidden = (await wake(rx.page)).requests.length;
    expect((await wake(rx.page)).held).toBe(0);
    await rx.page.evaluate(() => window.__wakeLock.setVisibility("visible"));
    await until(
      async () => (await wake(rx.page)).requests.length > whileHidden,
      "a request on visible",
    );
    await until(async () => (await wake(rx.page)).held === 1, "the lock held on visible");
    await loggedEvent(rx, "receiver.visibility", { state: "visible" });
  });

  test("without a wake lock API, plays the keep-awake clip (looping, muted, inline)", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { wakeLock: "missing" });
    await playPhoneView(rx);
    await until(async () => (await clip(rx.page))?.paused === false, "the clip playing");
    expect(await clip(rx.page)).toMatchObject({ muted: true, loop: true, playsInline: true });
    const t0 = (await clip(rx.page))?.time ?? 0;
    await until(async () => ((await clip(rx.page))?.time ?? 0) !== t0, "the clip moving");
    const missing = await loggedEvent(rx, "receiver.keepawake", {
      method: "wakeLock",
      ok: false,
    });
    expect(missing.error).toContain("unsupported");
    await loggedEvent(rx, "receiver.keepawake", { method: "video", ok: true });
    expect(rx.blocked).toEqual([]);
  });

  test("a refused wake lock falls back to the clip too, and says why", async ({ browser }) => {
    const rx = await openReceiver(browser, { wakeLock: "reject" });
    await playPhoneView(rx);
    await until(async () => (await clip(rx.page))?.paused === false, "the clip playing");
    expect((await wake(rx.page)).requests).toEqual(["screen"]);
    const refused = await loggedEvent(rx, "receiver.keepawake", {
      method: "wakeLock",
      ok: false,
    });
    expect(refused.level).toBe("warn");
    expect(refused.error).toContain("NotAllowedError");
    await loggedEvent(rx, "receiver.keepawake", { method: "video", ok: true });
  });

  for (const wakeLock of ["grant", "reject"] as const) {
    test(`the cast ending lets go of everything (wake lock: ${wakeLock})`, async ({ browser }) => {
      const rx = await openReceiver(browser, { clock: true, wakeLock });
      await playPhoneView(rx);
      if (wakeLock === "grant")
        await until(async () => (await wake(rx.page)).held === 1, "a wake lock held");
      else await until(async () => (await clip(rx.page))?.paused === false, "the clip playing");
      rx.stream.heartbeat = () => ({ status: 410, json: { ok: false, expired: true } });
      await rx.page.clock.fastForward(MIN);
      await until(async () => (await rx.stops()) > 0, "the cast to stop");
      await until(async () => (await wake(rx.page)).held === 0, "the wake lock released");
      if (wakeLock === "grant") expect((await wake(rx.page)).releasedByPage).toBe(1);
      else expect((await clip(rx.page))?.paused).toBe(true);
      // Released on purpose: not taken again.
      const requests = (await wake(rx.page)).requests.length;
      await new Promise((r) => setTimeout(r, 300));
      expect((await wake(rx.page)).requests.length).toBe(requests);
      await loggedEvent(rx, "receiver.keepawake", { step: "stop" });
    });
  }

  test("a new page whose start fails lets go too, and nothing is taken again", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await playPhoneView(rx);
    await until(async () => (await wake(rx.page)).held === 1, "a wake lock held");
    rx.stream.start = () => ({
      status: 503,
      json: { error: { code: "renderer_unavailable", message: "no GPU", status: 503 } },
    });
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: `${VIEW}&game=2`, streamServerUrl: STREAM });
    await until(
      async () => (await rx.status()).text === "Unable to connect to game stream",
      "the error",
    );
    expect(await wake(rx.page)).toEqual({ requests: ["screen"], held: 0, releasedByPage: 1 });
    // Shown again with nothing playing: no lock.
    await rx.page.evaluate(() => window.__wakeLock.setVisibility("hidden"));
    await rx.page.evaluate(() => window.__wakeLock.setVisibility("visible"));
    await new Promise((r) => setTimeout(r, 300));
    expect((await wake(rx.page)).requests).toEqual(["screen"]);
  });

  test("a laptop's picture keeps it awake too, until the laptop stops", async ({ browser }) => {
    const rx = await openReceiver(browser, { wakeLock: "reject" });
    const laptop = await rx.publisherPage();
    const sdp = await laptop.evaluate(() => window.offerPeer());
    await rx.deliver({ type: "PEER_OFFER", sdp, iceServers: [] }, "laptop");
    const [answer] = await until(async () => {
      const all = await rx.ofType("PEER_ANSWER");
      return all.length > 0 && all;
    }, "PEER_ANSWER");
    await laptop.evaluate((s) => window.acceptAnswer(s), String(answer.payload.sdp));
    await rx.nextFrame();
    await until(async () => (await clip(rx.page))?.paused === false, "the clip playing");
    expect((await wake(rx.page)).requests).toEqual(["screen"]);
    await rx.deliver({ type: "PEER_STOP" }, "laptop");
    await until(async () => (await clip(rx.page))?.paused === true, "the clip paused");
  });
});
