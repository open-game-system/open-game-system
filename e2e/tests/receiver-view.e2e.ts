// The TV receiver, phone path (acceptance: docs/acceptance/2026-10-04-cast-receiver-e2e.feature):
// a phone casts, the receiver asks for a view, the phone sends LOAD_VIEW, and the receiver starts
// that page on the phone's stream server and plays it. The stream server is a mock; its SFU is a
// real WebRTC peer, so the video plays real frames. Deterministic: no model, no network.
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { MIN, OTHER_STREAM, openReceiver, STREAM, until } from "./receiver-kit";

const VIEW = "https://game.ogs.test/tv?room=ABCD";
const ACCEPTS = ["view", "peer", "peer-canvas"];

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
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM }, "phone");
    const asked = (await rx.ofType("REQUEST_VIEW")).length;
    await rx.page.clock.runFor(10_000);
    expect((await rx.ofType("REQUEST_VIEW")).length).toBe(asked);
    expect(rx.blocked).toEqual([]);
  });

  test("starts the phone's view on the phone's stream server and plays its frames", async ({
    app,
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.connect("phone");
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: `${STREAM}/` }, "phone");
    const frame = await rx.nextFrame();
    expect(frame.width).toBe(640);
    expect(frame.height).toBe(360);
    await until(async () => !(await rx.status()).overlay, "the overlay to clear");

    const [start] = rx.callsTo("/start-stream");
    expect(start).toMatchObject({ base: STREAM, method: "POST", body: { url: VIEW } });
    expect(start.session).toMatch(/^rx-[a-z0-9]+$/);
    expect(rx.callsTo("/subscribe")[0].body).toEqual({
      publisherSessionId: "pub-1",
      trackNames: ["cast-video", "cast-audio"],
    });
    const answer = rx.callsTo("/subscribe/sub-1/answer")[0];
    expect(answer.method).toBe("PUT");
    expect(answer.body).toMatchObject({ sessionDescription: { type: "answer" } });
    expect(rx.stream.calls.map((c) => c.path)).toEqual([
      "/ice-servers",
      "/start-stream",
      "/subscribe",
      "/subscribe/sub-1/answer",
    ]);
    // Every step is told to the sender, so the phone can show where a cast is.
    const statuses = (await rx.ofType("STATUS")).map((m) => m.payload.status);
    expect(statuses).toEqual(
      expect.arrayContaining([
        "Starting stream...",
        "Subscribing to stream...",
        "Establishing connection...",
      ]),
    );
    await app.screenshot("receiver-playing");
    expect(rx.blocked).toEqual([]);
  });

  test("a second LOAD_VIEW for the same page is ignored; a new page restarts the stream", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM });
    await rx.nextFrame();
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM });
    expect(rx.callsTo("/start-stream").length).toBe(1);
    await rx.deliver({
      type: "LOAD_VIEW",
      viewUrl: `${VIEW}&game=2`,
      streamServerUrl: OTHER_STREAM,
    });
    await until(() => rx.callsTo("/subscribe").length === 2, "the second subscribe");
    const starts = rx.callsTo("/start-stream");
    expect(starts.map((s) => [s.base, s.body])).toEqual([
      [STREAM, { url: VIEW }],
      [OTHER_STREAM, { url: `${VIEW}&game=2` }],
    ]);
    expect(starts[1].session).not.toBe(starts[0].session);
  });

  test("URL parameters override: opened with a viewUrl it starts at once and asks nobody", async ({
    browser,
  }) => {
    const query = `?viewUrl=${encodeURIComponent(VIEW)}&streamUrl=${encodeURIComponent(OTHER_STREAM)}`;
    const rx = await openReceiver(browser, { query });
    await rx.nextFrame();
    expect(rx.callsTo("/start-stream").map((c) => [c.base, c.body])).toEqual([
      [OTHER_STREAM, { url: VIEW }],
    ]);
    expect(await rx.page.evaluate(() => window.__cast.started)).toBe(false);
    expect(await rx.ofType("REQUEST_VIEW")).toEqual([]);
  });

  test("a publisherSessionId parameter subscribes to that stream without starting one", async ({
    browser,
  }) => {
    const query = `?viewUrl=${encodeURIComponent(VIEW)}&streamServerUrl=${encodeURIComponent(STREAM)}&publisherSessionId=pub-9`;
    const rx = await openReceiver(browser, { query });
    await rx.nextFrame();
    expect(rx.callsTo("/start-stream")).toEqual([]);
    expect(rx.callsTo("/subscribe")[0].body).toMatchObject({ publisherSessionId: "pub-9" });
  });

  // Owner, 2026-10-05: a slow phone made the TV open an old default page (Trivia Jam) on the
  // production stream server. The TV only ever shows what a sender asks for.
  test("with no sender it never starts a stream on its own, and keeps waiting for the phone", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await rx.page.clock.runFor(60_000);
    expect(rx.stream.calls).toEqual([]);
    expect(await rx.page.locator("#status-text").textContent()).toBe("Waiting for the game...");
  });

  test("a sender that spoke (even only GET_STATE) keeps the default view from starting", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await rx.deliver({ type: "GET_STATE" }, "probe");
    await rx.page.clock.runFor(30_000);
    expect(rx.stream.calls).toEqual([]);
    expect((await rx.ofType("STATE"))[0]).toMatchObject({
      to: "probe",
      payload: { started: false },
    });
  });

  test("a failed start shows what went wrong, not a black screen, and stops the heartbeat", async ({
    app,
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    rx.stream.start = () => ({
      status: 500,
      json: { error: { code: "stream_start_failed", message: "chrome crashed", status: 500 } },
    });
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM });
    await expect(screen.getByText("Unable to connect to game stream")).toBeVisible();
    expect(await rx.status()).toEqual({
      text: "Unable to connect to game stream",
      overlay: true,
      spinner: false,
    });
    expect((await rx.ofType("STATUS")).at(-1)?.payload.status).toBe(
      "Unable to connect to game stream",
    );
    await app.screenshot("receiver-start-failed");
    // Nothing is streaming: the stream server must not be kept up (a GPU bills while pinged).
    await rx.page.clock.runFor(5 * MIN);
    expect(rx.callsTo("/heartbeat")).toEqual([]);
  });

  test("an unreachable stream server shows the error state too", async ({ browser, screen }) => {
    const rx = await openReceiver(browser);
    await rx.deliver({
      type: "LOAD_VIEW",
      viewUrl: VIEW,
      streamServerUrl: "https://down.ogs.test/api/v1/stream",
    });
    await expect(screen.getByText("Unable to connect to game stream")).toBeVisible();
    expect((await rx.status()).spinner).toBe(false);
    expect(rx.blocked).toEqual([
      "https://down.ogs.test/api/v1/stream/ice-servers",
      "https://down.ogs.test/api/v1/stream/start-stream",
    ]);
  });

  test("a failed subscribe shows the error state and stops the heartbeat", async ({
    browser,
    screen,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    rx.stream.subscribe = () => ({
      status: 500,
      json: { error: { code: "sfu_error", message: "quota", status: 500 } },
    });
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM });
    await expect(screen.getByText("Unable to connect to game stream")).toBeVisible();
    await rx.page.clock.runFor(5 * MIN);
    expect(rx.callsTo("/heartbeat")).toEqual([]);
  });
});
