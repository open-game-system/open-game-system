// The TV receiver, laptop path (acceptance: docs/acceptance/2026-10-04-cast-receiver-e2e.feature):
// a laptop streams its own tab (or its 3D canvas, with the game's HUD page drawn on the TV) straight
// to the receiver over WebRTC; the offer and answer ride the Cast message channel. The laptop is a
// second page in this browser with a real RTCPeerConnection: loopback ICE, no STUN, no TURN.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import type { Page } from "playwright";
import { HUD_URL, openReceiver, type Receiver, until } from "./receiver-kit";

/** The laptop offers; returns once the receiver has answered it. */
async function offer(rx: Receiver, laptop: Page, extra: Record<string, unknown> = {}) {
  const sdp = await laptop.evaluate(() => window.offerPeer());
  const before = (await rx.ofType("PEER_ANSWER")).length;
  await rx.deliver({ type: "PEER_OFFER", sdp, iceServers: [], ...extra }, "laptop");
  const answers = await until(async () => {
    const all = await rx.ofType("PEER_ANSWER");
    return all.length > before && all;
  }, "the receiver's PEER_ANSWER");
  const answer = answers[answers.length - 1];
  expect(answer.to).toBe("laptop");
  return String(answer.payload.sdp);
}

describe("TV receiver, a laptop's cast (PEER_OFFER)", {
  tags: ["receiver"],
  requires: ["browser"],
}, () => {
  test("plays the laptop's tab: answers over Cast and shows its frames, no HUD", async ({
    app,
    browser,
  }) => {
    const rx = await openReceiver(browser);
    const laptop = await rx.publisherPage();
    const answer = await offer(rx, laptop);
    await laptop.evaluate((sdp) => window.acceptAnswer(sdp), answer);
    const frame = await rx.nextFrame();
    expect(frame).toEqual({ width: 640, height: 360 });
    await until(async () => !(await rx.status()).overlay, "the overlay to clear");
    await expect(browser.locator("#hud")).toBeAttached({ attached: false });
    // A laptop's stream needs no cloud: nothing went to a stream server, and the asking stopped.
    expect(rx.stream.calls).toEqual([]);
    const asked = (await rx.ofType("REQUEST_VIEW")).length;
    await new Promise((r) => setTimeout(r, 1700));
    expect((await rx.ofType("REQUEST_VIEW")).length).toBe(asked);
    expect(await rx.ofType("PEER_ERROR")).toEqual([]);
    await app.screenshot("receiver-laptop");
    expect(rx.blocked).toEqual([]);
  });

  test("with hudUrl: draws the game's HUD page over the picture and feeds it the layout", async ({
    app,
    browser,
  }) => {
    const rx = await openReceiver(browser);
    const laptop = await rx.publisherPage();
    const answer = await offer(rx, laptop, { hudUrl: HUD_URL });
    await laptop.evaluate((sdp) => window.acceptAnswer(sdp), answer);
    await rx.nextFrame();
    await expect(browser.locator("#hud")).toBeAttached();
    // The HUD said HUD_READY before any layout; the next layout reaches it.
    await rx.deliver({ type: "HUD_MESSAGE", data: { score: 7 } }, "laptop");
    const hud = browser.frameLocator("#hud");
    await expect(hud.getByText("HUD score 7")).toBeVisible();
    await rx.deliver({ type: "GET_STATE" }, "laptop");
    const state = await until(async () => (await rx.ofType("STATE"))[0], "STATE");
    expect(state.payload).toMatchObject({
      viewUrl: "laptop",
      overlayVisible: false,
      hud: {
        url: HUD_URL,
        loaded: true,
        ready: true,
        last: { type: "HUD_SHOWING", score: 7 },
        layout: { score: 7 },
      },
    });
    await app.screenshot("receiver-laptop-hud");
  });

  test("a HUD that loads after the layout gets the last layout when it says HUD_READY", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    const laptop = await rx.publisherPage();
    await rx.deliver(
      {
        type: "PEER_OFFER",
        sdp: await laptop.evaluate(() => window.offerPeer()),
        iceServers: [],
        hudUrl: HUD_URL,
      },
      "laptop",
    );
    await rx.deliver({ type: "HUD_MESSAGE", data: { score: 3 } }, "laptop");
    await expect(browser.frameLocator("#hud").getByText("HUD score 3")).toBeVisible();
  });

  test("ignores a HUD url that isn't http(s)", async ({ browser }) => {
    const rx = await openReceiver(browser);
    const laptop = await rx.publisherPage();
    await offer(rx, laptop, { hudUrl: "javascript:alert(1)" });
    await expect(browser.locator("#hud")).toBeAttached({ attached: false });
  });

  test("no picture in 20 s: says so on the TV and tells the laptop (PEER_ERROR)", async ({
    app,
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    const laptop = await rx.publisherPage();
    await offer(rx, laptop); // the laptop never applies the answer: no connection, no picture
    await expect(screen.getByText("Connecting to the laptop...")).toBeVisible();
    // (The virtual clock also runs with real time, and answering took a moment of it.)
    await rx.page.clock.runFor(15_000);
    expect(await rx.ofType("PEER_ERROR")).toEqual([]);
    await rx.page.clock.runFor(5_000);
    const [error] = await until(
      () => rx.ofType("PEER_ERROR").then((e) => e.length > 0 && e),
      "PEER_ERROR",
    );
    expect(error).toMatchObject({
      to: "laptop",
      payload: { type: "PEER_ERROR", message: "no picture after 20s" },
    });
    await expect(
      screen.getByText(
        "The laptop's picture didn't arrive. Keep the laptop on the same Wi-Fi as this TV and cast again.",
      ),
    ).toBeVisible();
    expect((await rx.status()).spinner).toBe(false);
    await app.screenshot("receiver-laptop-timeout");
  });

  test("a bad offer is shown and told to the laptop", async ({ browser, screen }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({ type: "PEER_OFFER", sdp: "not an sdp", iceServers: [] }, "laptop");
    await expect(screen.getByText("Unable to connect to the laptop")).toBeVisible();
    const [error] = await until(
      () => rx.ofType("PEER_ERROR").then((e) => e.length > 0 && e),
      "PEER_ERROR",
    );
    expect(error.to).toBe("laptop");
  });

  test("PEER_STOP: the laptop stopped casting; the picture and HUD go", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser);
    const laptop = await rx.publisherPage();
    await laptop.evaluate(
      (sdp) => window.acceptAnswer(sdp),
      await offer(rx, laptop, { hudUrl: HUD_URL }),
    );
    await rx.nextFrame();
    await rx.deliver({ type: "PEER_STOP" }, "laptop");
    await expect(screen.getByText("The laptop stopped casting")).toBeVisible();
    await expect(browser.locator("#hud")).toBeAttached({ attached: false });
    expect(await rx.page.evaluate(() => document.querySelector("video")?.srcObject ?? null)).toBe(
      null,
    );
  });
});
