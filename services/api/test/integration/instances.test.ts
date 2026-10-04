import { SELF } from "cloudflare:test";
import { InstanceSchema } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { BASE, bearer, createHousehold, ErrorSchema, launcherToken, pairDevice } from "./helpers";

const instancesUrl = (hid: string) => `${BASE}/households/${hid}/instances`;

async function report(hid: string, token: string, body: Record<string, unknown>) {
  return SELF.fetch(instancesUrl(hid), {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify(body),
  });
}

async function list(hid: string, token: string) {
  const res = await SELF.fetch(instancesUrl(hid), { headers: bearer(token) });
  expect(res.status).toBe(200);
  return InstanceSchema.array().parse(await res.json());
}

describe("/households/:hid/instances", () => {
  it("records a bridge report (the game calls the OGS bridge with suspended, Day 4)", async () => {
    const h = await createHousehold();
    const before = Date.now();
    const res = await report(h.householdId, h.token, {
      instanceId: "bake-1",
      appId: "bake-shop",
      status: "suspended",
      title: "Day 4",
      detail: "Bear is waiting",
      resumeUrl: "https://bake-shop.jonathanrmumm.workers.dev/room/ABCD",
      source: "bridge",
    });
    expect(res.status).toBe(200);
    const saved = InstanceSchema.parse(await res.json());
    expect(saved).toMatchObject({
      instanceId: "bake-1",
      appId: "bake-shop",
      householdId: h.householdId,
      status: "suspended",
      title: "Day 4",
      detail: "Bear is waiting",
      source: "bridge",
    });
    expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
    expect(await list(h.householdId, h.token)).toEqual([saved]);
  });

  it("upserts by instanceId and keeps optional fields", async () => {
    const h = await createHousehold();
    await report(h.householdId, h.token, {
      instanceId: "rc-1",
      appId: "rocket-crew",
      status: "active",
      source: "visit",
    });
    const res = await report(h.householdId, h.token, {
      instanceId: "rc-1",
      appId: "rocket-crew",
      status: "waiting",
      title: "Mission 6",
      yourTurn: true,
      startsAt: 1_900_000_000_000,
      source: "bridge",
    });
    expect(res.status).toBe(200);
    const all = await list(h.householdId, h.token);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      status: "waiting",
      title: "Mission 6",
      detail: "",
      yourTurn: true,
      startsAt: 1_900_000_000_000,
      source: "bridge",
    });
    expect(all[0].resumeUrl).toBeUndefined();
  });

  it("lists newest first and accepts reports from tablets and the launcher", async () => {
    const h = await createHousehold();
    const tablet = await pairDevice(h, { kind: "tablet", personId: h.people[1].id, name: "iPad" });
    const launcher = await launcherToken(h);
    await report(h.householdId, tablet, {
      instanceId: "a",
      appId: "story-nook",
      status: "active",
      source: "visit",
    });
    await new Promise((r) => setTimeout(r, 5));
    await report(h.householdId, launcher, {
      instanceId: "b",
      appId: "night-flight",
      status: "lobby",
      source: "bridge",
    });
    expect((await list(h.householdId, h.token)).map((i) => i.instanceId)).toEqual(["b", "a"]);
  });

  it("keeps households apart", async () => {
    const a = await createHousehold();
    const b = await createHousehold("Other");
    await report(a.householdId, a.token, {
      instanceId: "same-id",
      appId: "bake-shop",
      status: "active",
      source: "visit",
    });
    await report(b.householdId, b.token, {
      instanceId: "same-id",
      appId: "story-nook",
      status: "active",
      source: "visit",
    });
    expect((await list(a.householdId, a.token)).map((i) => i.appId)).toEqual(["bake-shop"]);
    expect((await list(b.householdId, b.token)).map((i) => i.appId)).toEqual(["story-nook"]);
  });

  it("rejects a game outside the catalogue (400 unknown_app)", async () => {
    const h = await createHousehold();
    const res = await report(h.householdId, h.token, {
      instanceId: "x",
      appId: "word-duel",
      status: "active",
      source: "bridge",
    });
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("unknown_app");
  });

  it.each([
    ["a bad status", { instanceId: "x", appId: "bake-shop", status: "paused", source: "bridge" }],
    [
      "a server source",
      { instanceId: "x", appId: "bake-shop", status: "active", source: "server" },
    ],
    ["no instanceId", { appId: "bake-shop", status: "active", source: "bridge" }],
    [
      "a bad resumeUrl",
      {
        instanceId: "x",
        appId: "bake-shop",
        status: "active",
        source: "bridge",
        resumeUrl: "nope",
      },
    ],
  ])("rejects %s (400 invalid_body)", async (_label, body) => {
    const h = await createHousehold();
    const res = await report(h.householdId, h.token, body);
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("invalid_body");
  });

  it("rejects an update without a valid household token", async () => {
    const h = await createHousehold();
    const other = await createHousehold("Other");
    const body = { instanceId: "x", appId: "bake-shop", status: "active", source: "bridge" };
    const anon = await SELF.fetch(instancesUrl(h.householdId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(anon.status).toBe(401);
    expect((await report(h.householdId, "garbage", body)).status).toBe(401);
    expect((await report(h.householdId, other.token, body)).status).toBe(403);
    expect(await list(h.householdId, h.token)).toEqual([]);
  });
});
