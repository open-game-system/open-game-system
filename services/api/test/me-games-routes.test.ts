import type { Claims } from "@open-game-system/ogs-protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { catalogueIds } from "../src/catalogue";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import { openTestD1, type TestD1 } from "./support/d1";

/** /me/instances and /me/library against a real local D1. */
const SECRET = "me-games-secret";
let d1: TestD1;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('mom', 'mom', 'Mom', 'sun')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('dad', 'dad', 'Dad', 'moon')",
    ),
  ]);
});

const env = () => ({ DB: d1.db, OGS_JWT_SECRET: SECRET });
const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phone = (sub: string) => tokenFor({ sub, did: `${sub}-phone`, kind: "phone" });
const launcherOf = (sub: string) => tokenFor({ sub, did: "tv", kind: "launcher", sid: "s1" });

async function call(method: string, path: string, token: string, body?: unknown) {
  const res = await app.request(
    `/api/v1/me${path}`,
    {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );
  return { status: res.status, body: z.unknown().parse(await res.json()) };
}
const errorCode = (r: { body: unknown }) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(r.body).error.code;

describe("POST and GET /me/instances", () => {
  it("records a full report, then reads it back as the same instance", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const report = {
      instanceId: "i1",
      appId: "rocket-crew",
      status: "waiting",
      title: "Mission 3",
      detail: "Your move",
      yourTurn: true,
      startsAt: 5_000,
      resumeUrl: "https://rocket.example/i1",
      source: "bridge",
    };
    const posted = await call("POST", "/instances", await phone("mom"), report);
    expect(posted).toEqual({
      status: 200,
      body: { ...report, profileId: "mom", updatedAt: 1_000 },
    });
    const got = await call("GET", "/instances", await phone("mom"));
    expect(got.body).toEqual([{ ...report, profileId: "mom", updatedAt: 1_000 }]);
  });

  it("lists the most recently written instance first, even when writes share a millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const report = async (instanceId: string, status: string) =>
      call("POST", "/instances", await phone("mom"), {
        instanceId,
        appId: "bake-shop",
        status,
        source: "bridge",
      });
    await report("i1", "active");
    await report("i2", "active");
    await report("i1", "waiting");
    const order = async () =>
      z
        .array(z.object({ instanceId: z.string() }))
        .parse((await call("GET", "/instances", await phone("mom"))).body)
        .map((i) => i.instanceId);
    expect(await order()).toEqual(["i1", "i2"]);
    await report("i2", "suspended");
    expect(await order()).toEqual(["i2", "i1"]);
  });

  it("keeps optional fields absent, stores yourTurn false, and upserts by instance id", async () => {
    await call("POST", "/instances", await launcherOf("mom"), {
      instanceId: "i1",
      appId: "bake-shop",
      status: "active",
      source: "visit",
    });
    await call("POST", "/instances", await phone("mom"), {
      instanceId: "i2",
      appId: "bake-shop",
      status: "waiting",
      yourTurn: false,
      source: "bridge",
    });
    await call("POST", "/instances", await phone("mom"), {
      instanceId: "i1",
      appId: "bake-shop",
      status: "suspended",
      title: "Cupcakes",
      source: "visit",
    });
    const got = z
      .array(z.record(z.string(), z.unknown()))
      .parse((await call("GET", "/instances", await phone("mom"))).body);
    expect(got.map((i) => [i.instanceId, i.status, i.title, i.yourTurn])).toEqual([
      ["i1", "suspended", "Cupcakes", undefined],
      ["i2", "waiting", "", false],
    ]);
    expect(got[0]).not.toHaveProperty("startsAt");
    expect(got[0]).not.toHaveProperty("resumeUrl");
    expect((await call("GET", "/instances", await phone("dad"))).body).toEqual([]);
  });

  it.each([
    [
      "a server-sourced report",
      { instanceId: "i", appId: "bake-shop", status: "active", source: "server" },
      "invalid_body",
    ],
    ["a missing status", { instanceId: "i", appId: "bake-shop", source: "visit" }, "invalid_body"],
    [
      "a game not in the catalogue",
      { instanceId: "i", appId: "pong", status: "active", source: "visit" },
      "unknown_app",
    ],
  ])("refuses %s", async (_label, body, code) => {
    const r = await call("POST", "/instances", await phone("mom"), body);
    expect(r.status).toBe(400);
    expect(errorCode(r)).toBe(code);
  });
});

describe("GET and PUT /me/library", () => {
  it("is the whole catalogue until changed, then the chosen games, ordered and de-duplicated", async () => {
    expect((await call("GET", "/library", await phone("mom"))).body).toEqual({
      appIds: catalogueIds(),
    });
    const put = await call("PUT", "/library", await phone("mom"), {
      appIds: ["night-flight", "bake-shop", "night-flight"],
    });
    expect(put).toEqual({ status: 200, body: { appIds: ["night-flight", "bake-shop"] } });
    expect((await call("GET", "/library", await launcherOf("mom"))).body).toEqual({
      appIds: ["night-flight", "bake-shop"],
    });
  });

  it("drops games since removed from the catalogue", async () => {
    await d1.db
      .prepare("UPDATE profiles SET library = ? WHERE id = 'mom'")
      .bind('["gone-game","bake-shop"]')
      .run();
    expect((await call("GET", "/library", await phone("mom"))).body).toEqual({
      appIds: ["bake-shop"],
    });
  });

  it.each([
    ["unknown games", { appIds: ["bake-shop", "pong", "chess"] }, 400, "unknown_app"],
    ["a non-list", { appIds: "bake-shop" }, 400, "invalid_body"],
  ])("refuses %s", async (_label, body, status, code) => {
    const r = await call("PUT", "/library", await phone("mom"), body);
    expect(r.status).toBe(status);
    expect(errorCode(r)).toBe(code);
  });

  it("names every unknown game", async () => {
    const r = await call("PUT", "/library", await phone("mom"), { appIds: ["pong", "chess"] });
    expect(z.object({ error: z.object({ message: z.string() }) }).parse(r.body).error.message).toBe(
      "Not in the catalogue: pong, chess",
    );
  });

  it("refuses a launcher changing the library", async () => {
    const r = await call("PUT", "/library", await launcherOf("mom"), { appIds: [] });
    expect(r.status).toBe(403);
    expect(errorCode(r)).toBe("profile_token_required");
  });
});
