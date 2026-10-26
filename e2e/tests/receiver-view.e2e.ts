// The TV receiver, phone path (acceptance: docs/acceptance/2026-10-04-cast-receiver-e2e.feature):
// a phone casts, the receiver asks for a view, the phone sends LOAD_VIEW. There is no cloud renderer
// (ADR 2026-10-25) and the phone's P2P stream of the page is not built yet, so the TV says so and
// asks no server to render anything. Deterministic: no model, no network.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { API, openReceiver, until } from "./receiver-kit";

const VIEW = "https://game.ogs.test/tv?room=ABCD";
const ACCEPTS = ["view", "peer", "peer-canvas"];
const NOT_YET = "This TV can't show games from the OGS app yet";

describe("TV receiver, a phone's cast (LOAD_VIEW)", {
  tags: ["receiver"],
  requires: ["browser"],
}, () => {
  test("asks every sender for a view until one arrives, then stops asking", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await expect(screen.getByText("Waiting for the game...")).toBeVisible();
    await rx.page.clock.runFor(1500);
    const asks = await rx.ofType("REQUEST_VIEW");
    expect(asks.length).toBe(1);
    expect(asks[0].to).toBe(null);
    expect(asks[0].payload).toEqual({ type: "REQUEST_VIEW", accepts: ACCEPTS });
    await rx.page.clock.runFor(3000);
    expect((await rx.ofType("REQUEST_VIEW")).length).toBe(3);
    // A phone that connects is asked at once, by name.
    await rx.connect("phone");
    expect((await rx.ofType("REQUEST_VIEW")).filter((m) => m.to === "phone").length).toBe(1);
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    const asked = (await rx.ofType("REQUEST_VIEW")).length;
    await rx.page.clock.runFor(10_000);
    expect((await rx.ofType("REQUEST_VIEW")).length).toBe(asked);
    expect(rx.blocked).toEqual([]);
  });

  test("a phone's view: the TV says it can't show it yet, and no renderer is asked", async ({
    app,
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser);
    await rx.connect("phone");
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await expect(screen.getByText(NOT_YET)).toBeVisible();
    expect(await rx.status()).toEqual({ text: NOT_YET, overlay: true, spinner: false });
    // The phone is told too, so it can show where the cast is.
    expect((await rx.ofType("STATUS")).at(-1)?.payload.status).toBe(NOT_YET);
    await app.screenshot("receiver-view-not-yet");
    await new Promise((r) => setTimeout(r, 300));
    expect(rx.blocked).toEqual([]);
  });

  test("an older app's LOAD_VIEW (streamServerUrl, no apiUrl) asks no renderer either", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({
      type: "LOAD_VIEW",
      viewUrl: VIEW,
      streamServerUrl: "https://opengame-api.jonathanrmumm.workers.dev/api/v1/stream",
    });
    await expect(screen.getByText(NOT_YET)).toBeVisible();
    await new Promise((r) => setTimeout(r, 300));
    expect(rx.blocked).toEqual([]);
  });

  test("a phone's view replaces a laptop's picture", async ({ browser, screen }) => {
    const rx = await openReceiver(browser);
    const laptop = await rx.publisherPage();
    const sdp = await laptop.evaluate(() => window.offerPeer());
    await rx.deliver({ type: "PEER_OFFER", sdp, iceServers: [] }, "laptop");
    const [answer] = await until(async () => {
      const all = await rx.ofType("PEER_ANSWER");
      return all.length > 0 && all;
    }, "PEER_ANSWER");
    await laptop.evaluate((s) => window.acceptAnswer(s), String(answer.payload.sdp));
    await rx.nextFrame();
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await expect(screen.getByText(NOT_YET)).toBeVisible();
    expect(await rx.page.evaluate(() => document.querySelector("video")?.srcObject ?? null)).toBe(
      null,
    );
  });

  // Owner, 2026-10-05: a slow phone made the TV open an old default page (Trivia Jam). The TV only
  // ever shows what a sender asks for.
  test("with no sender it shows nothing on its own, and keeps waiting for the phone", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await rx.page.clock.runFor(60_000);
    expect(await rx.page.locator("#status-text").textContent()).toBe("Waiting for the game...");
    expect(rx.blocked).toEqual([]);
  });

  test("a sender that spoke only GET_STATE gets the state, and nothing starts", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await rx.deliver({ type: "GET_STATE" }, "probe");
    await rx.page.clock.runFor(30_000);
    expect((await rx.ofType("STATE"))[0]).toMatchObject({
      to: "probe",
      payload: { started: false },
    });
    expect(rx.blocked).toEqual([]);
  });
});
