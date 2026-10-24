import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BASE, bearer, createProfile, unique } from "./helpers";

// docs/acceptance/2026-10-23-airplay-display.feature, "Claude reads a phone's log back": the real
// ClientLog Durable Object behind POST and GET /api/v1/client-events.
const KEY = "integration-log-key";

const Events = z.object({ bucket: z.string(), events: z.array(z.record(z.string(), z.unknown())) });
const Buckets = z.object({
  buckets: z.array(
    z.object({ bucket: z.string(), count: z.number(), appId: z.string().nullable() }),
  ),
});

describe("the stored client log", () => {
  it("keeps a launch's events and reads them back with the log key", async () => {
    const me = await createProfile();
    const launchId = unique("launch");
    const post = await SELF.fetch(`${BASE}/client-events`, {
      method: "POST",
      headers: bearer(me.token),
      body: JSON.stringify({
        context: { app: "shell", appId: "settlewood", launchId, platform: "ios 26.4" },
        events: [
          { name: "native.display.attach", at: 1, level: "info", data: { w: 1920 } },
          { name: "airplay.connected", at: 2, level: "info", data: { name: "Kitchen" } },
        ],
      }),
    });
    expect(post.status).toBe(202);

    const denied = await SELF.fetch(`${BASE}/client-events?launch=${launchId}`);
    expect(denied.status).toBe(403);

    const read = await SELF.fetch(`${BASE}/client-events?launch=${launchId}`, {
      headers: { "x-log-key": KEY },
    });
    expect(read.status).toBe(200);
    const body = Events.parse(await read.json());
    expect(body.bucket).toBe(`launch:${launchId}`);
    expect(body.events.map((e) => e.name)).toEqual(["native.display.attach", "airplay.connected"]);
    expect(body.events[0]).toMatchObject({
      profileId: me.profile.id,
      appId: "settlewood",
      data: { w: 1920 },
    });

    const list = await SELF.fetch(`${BASE}/client-events?appId=settlewood`, {
      headers: { "x-log-key": KEY },
    });
    const buckets = Buckets.parse(await list.json()).buckets;
    expect(buckets.find((b) => b.bucket === `launch:${launchId}`)).toMatchObject({
      count: 2,
      appId: "settlewood",
    });
  });
});
