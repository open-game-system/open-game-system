// The TV receiver's wide events (acceptance: docs/acceptance/2026-10-05-cast-logging.feature): it
// has no credentials, so it posts its key steps without a token to POST /api/v1/client-events on
// its stream server's API (the API writes them to Workers Logs): LOAD_VIEW received, the stream
// started or failed, the heartbeat's 410, the cast ending. Never the view URL (its launcher token).
import { test } from "@e2e-dev/web";
import { describe, expect } from "e2e";
import { z } from "zod";
import { MIN, openReceiver, type Receiver, STREAM, until } from "./receiver-kit";

const VIEW = "https://launcher.ogs.test/?api=x&token=secret-launcher-token";
const API_EVENTS = "https://stream.ogs.test/api/v1/client-events";

const Batch = z.object({
  context: z.object({ app: z.literal("receiver"), version: z.string(), platform: z.string() }),
  events: z.array(
    z.object({
      name: z.string(),
      at: z.number(),
      level: z.enum(["debug", "info", "warn", "error"]),
      attemptId: z.string().optional(),
      durationMs: z.number().optional(),
      error: z.string().optional(),
      data: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional(),
    }),
  ),
});

const logged = (rx: Receiver) =>
  rx.events.flatMap((post) => Batch.parse(post.body).events.map((e) => ({ ...e, url: post.url })));
const named = (rx: Receiver, name: string) => logged(rx).filter((e) => e.name === name);

async function run(rx: Receiver, ms: number) {
  for (let left = ms; left > 0; left -= MIN) await rx.page.clock.fastForward(Math.min(left, MIN));
  await new Promise((r) => setTimeout(r, 150));
}

describe("TV receiver logs (wide events, no credentials)", {
  tags: ["receiver"],
  requires: ["browser"],
}, () => {
  test("LOAD_VIEW received and the stream started go to the stream server's API, without a token", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser);
    await rx.connect("phone");
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM }, "phone");
    await until(() => named(rx, "receiver.stream.started").length > 0, "stream.started logged");
    expect(rx.events.every((p) => p.url === API_EVENTS && p.authorization === undefined)).toBe(
      true,
    );
    expect(Batch.parse(rx.events[0].body).context).toMatchObject({ app: "receiver" });
    expect(named(rx, "receiver.load_view.received")[0]).toMatchObject({
      level: "info",
      data: { view: "launcher.ogs.test", stream: "stream.ogs.test" },
    });
    const started = named(rx, "receiver.stream.started")[0];
    expect(started.durationMs).toEqual(expect.any(Number));
    // One receiver run reads as one story: every event carries its run id.
    const runs = new Set(logged(rx).map((e) => e.attemptId));
    expect(runs.size).toBe(1);
    expect(JSON.stringify(rx.events)).not.toContain("secret-launcher-token");
    expect(rx.blocked).toEqual([]);
  });

  test("a stream that can't start is an error event with the reason", async ({ browser }) => {
    const rx = await openReceiver(browser);
    rx.stream.start = () => ({
      status: 503,
      json: { error: { code: "renderer_unavailable", message: "no GPU", status: 503 } },
    });
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM });
    const [failed] = await until(() => {
      const f = named(rx, "receiver.stream.failed");
      return f.length > 0 ? f : null;
    }, "stream.failed logged");
    expect(failed.level).toBe("error");
    expect(failed.error).toContain("503");
  });

  test("the heartbeat's 410 and the cast ending are logged, and sent at once", async ({
    browser,
  }) => {
    const rx = await openReceiver(browser, { clock: true });
    await rx.connect("phone");
    await rx.deliver({ type: "LOAD_VIEW", viewUrl: VIEW, streamServerUrl: STREAM }, "phone");
    await until(() => rx.callsTo("/subscribe/sub-1/answer").length > 0, "the stream to start");
    rx.stream.heartbeat = () => ({ status: 410, json: { ok: false, expired: true } });
    await run(rx, 1 * MIN);
    await until(() => named(rx, "receiver.cast.ended").length > 0, "cast.ended logged");
    expect(named(rx, "receiver.heartbeat.ended")[0]).toMatchObject({
      level: "warn",
      data: { status: 410 },
    });
    expect(named(rx, "receiver.cast.ended")[0].data).toEqual({
      why: "the stream server ended the stream",
    });
  });
});
