// The TV receiver, phone path (acceptance: docs/acceptance/2026-10-04-cast-receiver-e2e.feature):
// a phone casts, the receiver asks for a view, the phone sends LOAD_VIEW. There is no cloud renderer
// (ADR 2026-10-25): the TV renders the page itself, in the OGS TV receiver (apps/tv/receiver.html,
// stubbed here) that this page frames and relays the view namespace to (ADR
// 2026-10-25-cast-local-render). Deterministic: no model, no network.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { API, openReceiver, TV_RECEIVER, until } from "./receiver-kit";

const VIEW = "https://game.ogs.test/tv?room=ABCD";
const ACCEPTS = ["view", "peer", "peer-canvas"];
const NOT_YET = "This TV can't show games from the OGS app yet";
const LOCAL = `${TV_RECEIVER}?host=parent`;

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

  test("a phone's view is rendered on the TV: the OGS TV receiver is framed and gets the LOAD_VIEW", async ({
    app,
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.connect("phone");
    const view = {
      type: "LOAD_VIEW",
      viewUrl: VIEW,
      apiUrl: API,
      attemptId: "cast-1",
      sessionId: "s1",
    };
    await rx.deliver(view, "phone");
    await until(
      async () => (await rx.local()).got.length > 0,
      "the LOAD_VIEW relayed to the TV receiver",
    );
    const local = await rx.local();
    expect(local.src).toBe(LOCAL);
    expect(local.got).toEqual([{ ogsRx: "in", senderId: "phone", data: view }]);
    // Full screen, over the status card and the video.
    expect(await rx.page.locator("#local-view").boundingBox()).toMatchObject({ x: 0, y: 0 });
    expect(await rx.page.locator("#local-view").isVisible()).toBe(true);
    expect(await rx.page.getByText(NOT_YET).count()).toBe(0);
    expect((await rx.status()).overlay).toBe(false);
    await app.screenshot("receiver-view-local");
    expect(rx.blocked).toEqual([]);
  });

  test("a new view goes to the same TV receiver (no second frame); a repeat is not relayed", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: `${VIEW}2`, apiUrl: API }, "phone");
    await until(async () => (await rx.local()).got.length === 2, "two views relayed");
    expect((await rx.local()).got.map((m) => m.data.viewUrl)).toEqual([VIEW, `${VIEW}2`]);
    expect(await rx.page.locator("#local-view").count()).toBe(1);
  });

  test("while a phone's view shows, GET_STATE is answered by the TV receiver, to that sender", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await until(async () => (await rx.local()).got.length > 0, "view relayed");
    await rx.deliver({ type: "GET_STATE" }, "probe");
    const [state] = await until(async () => {
      const all = (await rx.ofType("STATE")).filter((m) => m.payload.local === true);
      return all.length > 0 && all;
    }, "STATE from the TV receiver");
    expect(state).toMatchObject({
      to: "probe",
      payload: { type: "STATE", local: true, tier: "lite" },
    });
  });

  test("the TV receiver ending the cast stops the Cast app and takes its frame down", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await until(async () => (await rx.local()).got.length > 0, "view relayed");
    await rx.localStop();
    await until(async () => (await rx.stops()) === 1, "Cast stopped");
    expect((await rx.local()).src).toBe(null);
    await expect(screen.getByText("This TV session has ended")).toBeVisible();
  });

  test("a laptop's offer after a phone's view takes the TV receiver down", async ({ browser }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, apiUrl: API }, "phone");
    await until(async () => (await rx.local()).src !== null, "local frame");
    const laptop = await rx.publisherPage();
    const sdp = await laptop.evaluate(() => window.offerPeer());
    await rx.deliver({ type: "PEER_OFFER", sdp, iceServers: [] }, "laptop");
    await until(async () => (await rx.ofType("PEER_ANSWER")).length > 0, "PEER_ANSWER");
    expect((await rx.local()).src).toBe(null);
  });

  test("an older app's LOAD_VIEW (streamServerUrl, no apiUrl) is rendered locally too, no renderer asked", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({
      type: "LOAD_VIEW",
      viewUrl: VIEW,
      streamServerUrl: "https://opengame-api.jonathanrmumm.workers.dev/api/v1/stream",
    });
    await until(async () => (await rx.local()).got.length > 0, "view relayed");
    expect((await rx.local()).src).toBe(LOCAL);
    await new Promise((r) => setTimeout(r, 300));
    expect(rx.blocked).toEqual([]);
  });

  test("a phone's view replaces a laptop's picture", async ({ browser }) => {
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
    await until(async () => (await rx.local()).src === LOCAL, "the TV receiver framed");
    expect(await rx.page.locator("#local-view").isVisible()).toBe(true);
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
