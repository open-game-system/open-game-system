// The TV receiver never streams to an empty room (acceptance:
// docs/acceptance/2026-10-04-cast-receiver-e2e.feature). A cast keeps a cloud GPU up while the
// receiver's heartbeat reaches the stream server; it ends when (a) the renderer finds no player
// activity for 20 minutes (window.__ogsActivityAt, kept fresh by the launcher) or the 3-hour
// lifetime and answers 410, (b) no phone has been connected for 20 minutes, (c) 3 hours pass.
// The stream server's "stop" is the heartbeat stopping (it then scales to zero); there is no stop
// endpoint. Playwright's virtual clock runs the hours.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { isIdle } from "../../services/api/container/src/stream-lifetime";
import { MIN, openReceiver, type Receiver, STREAM, until } from "./receiver-kit";

const VIEW = "https://launcher.ogs.test/?token=t";
const HOUR = 60 * MIN;
const ENDED = "This TV session has ended";

/** A phone casts the launcher; resolves once the stream is up (the receiver answered the SFU). */
async function casting(rx: Receiver) {
  await rx.connect("phone");
  await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM }, "phone");
  await until(() => rx.callsTo("/subscribe/sub-1/answer").length > 0, "the stream to start");
  return rx.callsTo("/start-stream")[0].session;
}

/**
 * Moves the page's clock on a minute at a time (each due timer fires once per step: the 1-minute
 * heartbeat fires every step, while the publisher's 30 fps painting doesn't replay hours of frames),
 * then lets the requests its timers sent reach the mock.
 */
async function run(rx: Receiver, ms: number) {
  for (let left = ms; left > 0; left -= MIN) await rx.page.clock.fastForward(Math.min(left, MIN));
  await new Promise((r) => setTimeout(r, 150));
}

const pings = (rx: Receiver) => rx.callsTo("/heartbeat").length;

describe("TV receiver stops (idle, no phone, 3 hours)", {
  tags: ["receiver"],
  requires: ["browser"],
}, () => {
  test("pings the stream server every minute, with its stream session, while casting", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    const session = await casting(rx);
    await run(rx, 1 * MIN);
    expect(pings(rx)).toBe(1);
    await run(rx, 2 * MIN);
    expect(pings(rx)).toBe(3);
    expect(
      rx.callsTo("/heartbeat").every((c) => c.method === "POST" && c.session === session),
    ).toBe(true);
  });

  test("the renderer's idle stop: 20 min without player activity ends the cast; activity resets it", async ({
    app,
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    // The renderer's rule (services/api/container: isIdle on the streamed page's __ogsActivityAt).
    let activityAt = await rx.page.evaluate(() => Date.now());
    const now = () => rx.page.evaluate(() => Date.now());
    rx.stream.heartbeat = () => ({ status: 200, json: { ok: true } });
    const idleAware = async () => {
      if (isIdle(activityAt, await now(), 20 * MIN)) {
        rx.stream.heartbeat = () => ({ status: 410, json: { ok: false, expired: true } });
      }
    };
    await casting(rx);
    await run(rx, 10 * MIN);
    activityAt = await now(); // a player pressed something on the launcher
    await run(rx, 15 * MIN);
    await idleAware();
    expect(await rx.stops()).toBe(0);
    expect((await rx.status()).overlay).toBe(false);
    await run(rx, 6 * MIN);
    await idleAware();
    await run(rx, 1 * MIN);
    await expect(screen.getByText(ENDED)).toBeVisible();
    expect(await rx.stops()).toBe(1);
    const last = pings(rx);
    await run(rx, 10 * MIN);
    expect(pings(rx)).toBe(last);
    await app.screenshot("receiver-ended");
  });

  test("no phone for 20 minutes: stops the cast and the heartbeat; a phone coming back resets it", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await casting(rx);
    await rx.connect("ipad");
    await rx.disconnect("phone");
    await run(rx, 25 * MIN); // the iPad is still here
    expect(await rx.stops()).toBe(0);
    await rx.disconnect("ipad");
    await run(rx, 19 * MIN);
    expect(await rx.stops()).toBe(0);
    await rx.connect("phone"); // back in time
    await rx.disconnect("phone");
    await run(rx, 19 * MIN);
    expect(await rx.stops()).toBe(0);
    await run(rx, 2 * MIN);
    expect(await rx.stops()).toBe(1);
    await expect(screen.getByText(ENDED)).toBeVisible();
    const last = pings(rx);
    await run(rx, 10 * MIN);
    expect(pings(rx)).toBe(last);
  });

  test("3 hours: stops the cast and the heartbeat even with phones connected", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await casting(rx);
    await run(rx, 3 * HOUR - 1 * MIN);
    expect(await rx.stops()).toBe(0);
    await run(rx, 2 * MIN);
    expect(await rx.stops()).toBe(1);
    await expect(screen.getByText(ENDED)).toBeVisible();
    const last = pings(rx);
    await run(rx, 10 * MIN);
    expect(pings(rx)).toBe(last);
  });

  test("tells Cast not to idle out (it plays WebRTC, not Cast media)", async ({ browser }) => {
    const rx = await openReceiver(browser);
    expect(await rx.page.evaluate(() => window.__cast.idleTimeoutDisabled)).toBe(true);
  });
});
