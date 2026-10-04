import { SELF } from "cloudflare:test";
import { InstanceSchema } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { BASE, bearer, createProfile, createSession, ErrorSchema } from "./helpers";

const instancesUrl = `${BASE}/me/instances`;

async function report(token: string, body: Record<string, unknown>) {
  return SELF.fetch(instancesUrl, {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify(body),
  });
}

async function list(token: string) {
  const res = await SELF.fetch(instancesUrl, { headers: bearer(token) });
  expect(res.status).toBe(200);
  return InstanceSchema.array().parse(await res.json());
}

describe("/me/instances", () => {
  it("records a bridge report (the game calls the OGS bridge with suspended, Day 4)", async () => {
    const h = await createProfile();
    const before = Date.now();
    const res = await report(h.token, {
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
      profileId: h.profile.id,
      status: "suspended",
      title: "Day 4",
      detail: "Bear is waiting",
      source: "bridge",
    });
    expect(saved.updatedAt).toBeGreaterThanOrEqual(before);
    expect(await list(h.token)).toEqual([saved]);
  });

  it("upserts by instanceId and keeps optional fields", async () => {
    const h = await createProfile();
    await report(h.token, {
      instanceId: "rc-1",
      appId: "rocket-crew",
      status: "active",
      source: "visit",
    });
    const res = await report(h.token, {
      instanceId: "rc-1",
      appId: "rocket-crew",
      status: "waiting",
      title: "Mission 6",
      yourTurn: true,
      startsAt: 1_900_000_000_000,
      source: "bridge",
    });
    expect(res.status).toBe(200);
    const all = await list(h.token);
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

  it("lists newest first and accepts reports from the host's TV launcher", async () => {
    const h = await createProfile({ kind: "tablet" });
    const launcher = (await createSession(h)).token;
    await report(h.token, {
      instanceId: "a",
      appId: "story-nook",
      status: "active",
      source: "visit",
    });
    await new Promise((r) => setTimeout(r, 5));
    await report(launcher, {
      instanceId: "b",
      appId: "night-flight",
      status: "lobby",
      source: "bridge",
    });
    expect((await list(h.token)).map((i) => i.instanceId)).toEqual(["b", "a"]);
  });

  it("keeps profiles apart", async () => {
    const a = await createProfile();
    const b = await createProfile();
    await report(a.token, {
      instanceId: "same-id",
      appId: "bake-shop",
      status: "active",
      source: "visit",
    });
    await report(b.token, {
      instanceId: "same-id",
      appId: "story-nook",
      status: "active",
      source: "visit",
    });
    expect((await list(a.token)).map((i) => i.appId)).toEqual(["bake-shop"]);
    expect((await list(b.token)).map((i) => i.appId)).toEqual(["story-nook"]);
  });

  it("rejects a game outside the catalogue (400 unknown_app)", async () => {
    const h = await createProfile();
    const res = await report(h.token, {
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
    const h = await createProfile();
    const res = await report(h.token, body);
    expect(res.status).toBe(400);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("invalid_body");
  });

  it("rejects an update without a valid profile token", async () => {
    const h = await createProfile();
    const body = { instanceId: "x", appId: "bake-shop", status: "active", source: "bridge" };
    const anon = await SELF.fetch(instancesUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(anon.status).toBe(401);
    expect((await report("garbage", body)).status).toBe(401);
    expect(await list(h.token)).toEqual([]);
  });
});
