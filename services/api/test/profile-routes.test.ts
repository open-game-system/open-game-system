import type { Claims } from "@open-game-system/ogs-protocol";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken, readClaims } from "../src/lib/identity";
import { unlessHandleTaken } from "../src/routes/profiles";
import { openTestD1, type TestD1 } from "./support/d1";

/** POST /profiles, GET /handles, GET and PATCH /me against a real local D1. */
const SECRET = "profile-routes-secret";
let d1: TestD1;

beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db.batch([
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('mom', 'mom', 'Mom', 'sun')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('jm', 'jonathan.m', 'J', 'moon')",
    ),
    d1.db.prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('jm2', 'jonathan.m2', 'J', 'moon')",
    ),
  ]);
});

const env = () => ({ DB: d1.db, OGS_JWT_SECRET: SECRET });
const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const DEVICE = { deviceId: "ipad-1", kind: "tablet", name: "iPad" };
const Body = z.record(z.string(), z.unknown());

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(
    `/api/v1${path}`,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env(),
  );
  return { status: res.status, body: Body.parse(await res.json()) };
}
const errorCode = (r: { body: Record<string, unknown> }) =>
  z.object({ error: z.object({ code: z.string() }) }).parse(r.body).error.code;

describe("GET /handles", () => {
  it.each([
    [
      "a free typed handle",
      "?handle=@Juneau",
      { handle: "juneau", available: true, suggestion: "juneau" },
    ],
    [
      "a taken typed handle",
      "?handle=mom",
      { handle: "mom", available: false, suggestion: "mom2" },
    ],
    [
      "a name whose handle and first number are taken",
      "?name=Jonathan%20Mumm",
      { handle: "jonathan.m", available: false, suggestion: "jonathan.m3" },
    ],
    [
      "a typed handle over a name",
      "?handle=kid&name=Mom",
      { handle: "kid", available: true, suggestion: "kid" },
    ],
  ])("suggests for %s", async (_label, query, expected) => {
    expect(await call("GET", `/handles${query}`)).toEqual({ status: 200, body: expected });
  });

  it.each([
    ["nothing", ""],
    ["an invalid handle", "?handle=a"],
    ["an empty name", "?name="],
  ])("refuses %s", async (_label, query) => {
    const r = await call("GET", `/handles${query}`);
    expect(r.status).toBe(400);
    expect(errorCode(r)).toBe("invalid_body");
  });
});

describe("POST /profiles", () => {
  it("makes a profile with a free handle from the name and a device token", async () => {
    const r = await call("POST", "/profiles", {
      name: "Jonathan Mumm",
      sticker: "rocket",
      device: DEVICE,
    });
    expect(r.status).toBe(201);
    const { profile, token } = z
      .object({
        profile: z.object({
          id: z.string(),
          handle: z.string(),
          name: z.string(),
          sticker: z.string(),
        }),
        token: z.string(),
      })
      .parse(r.body);
    expect(profile).toMatchObject({
      handle: "jonathan.m3",
      name: "Jonathan Mumm",
      sticker: "rocket",
    });
    expect(await readClaims(token, SECRET, Date.now())).toMatchObject({
      sub: profile.id,
      did: "ipad-1",
      kind: "tablet",
    });
    const device = await d1.db
      .prepare("SELECT profile_id FROM profile_devices WHERE device_id = 'ipad-1'")
      .first();
    expect(device).toEqual({ profile_id: profile.id });
  });

  it("keeps a chosen handle", async () => {
    const r = await call("POST", "/profiles", {
      name: "Juneau",
      handle: "@Rocket.Boy",
      sticker: "r",
      device: DEVICE,
    });
    expect(r.body).toMatchObject({ profile: { handle: "rocket.boy" } });
  });

  it("refuses a chosen handle that is taken", async () => {
    const r = await call("POST", "/profiles", {
      name: "X",
      handle: "mom",
      sticker: "r",
      device: DEVICE,
    });
    expect(r.status).toBe(409);
    expect(errorCode(r)).toBe("handle_taken");
  });

  it.each([
    ["no device", { name: "X", sticker: "r" }],
    ["a blank name", { name: " ", sticker: "r", device: DEVICE }],
    ["an invalid handle", { name: "X", handle: "!", sticker: "r", device: DEVICE }],
  ])("refuses %s", async (_label, body) => {
    const r = await call("POST", "/profiles", body);
    expect(r.status).toBe(400);
    expect(errorCode(r)).toBe("invalid_body");
  });
});

describe("unlessHandleTaken (a write racing past the free-handle check)", () => {
  async function run(write: () => Promise<unknown>) {
    const mini = new Hono();
    mini.get("/", async (c) => (await unlessHandleTaken(c, write)) ?? c.json({ wrote: true }));
    mini.onError((e, c) => c.json({ threw: e.message }, 500));
    const res = await mini.request("/");
    return { status: res.status, body: Body.parse(await res.json()) };
  }
  const insert = (id: string, handle: string) => () =>
    d1.db
      .prepare("INSERT INTO profiles (id, handle, name, sticker) VALUES (?, ?, 'N', 's')")
      .bind(id, handle)
      .run();

  it("answers 409 handle_taken for D1's UNIQUE(handle) violation", async () => {
    const r = await run(insert("new", "mom"));
    expect(r.status).toBe(409);
    expect(errorCode(r)).toBe("handle_taken");
  });

  it("rethrows other constraint errors and passes a clean write", async () => {
    expect((await run(insert("mom", "fresh"))).body.threw).toMatch(
      /UNIQUE constraint failed: profiles.id/,
    );
    expect(await run(insert("new", "fresh"))).toEqual({ status: 200, body: { wrote: true } });
  });
});

describe("GET and PATCH /me", () => {
  const momPhone = () => tokenFor({ sub: "mom", did: "mom-phone", kind: "phone" });

  it("reads the profile and its logins", async () => {
    expect(await call("GET", "/me", undefined, await momPhone())).toEqual({
      status: 200,
      body: { profile: { id: "mom", handle: "mom", name: "Mom", sticker: "sun" }, logins: [] },
    });
  });

  it("edits only the fields sent", async () => {
    const r = await call("PATCH", "/me", { handle: "@Mama", sticker: "star" }, await momPhone());
    expect(r).toEqual({
      status: 200,
      body: { profile: { id: "mom", handle: "mama", name: "Mom", sticker: "star" }, logins: [] },
    });
    const renamed = await call("PATCH", "/me", { name: "Mother" }, await momPhone());
    expect(renamed.body).toMatchObject({
      profile: { handle: "mama", name: "Mother", sticker: "star" },
    });
  });

  it("keeps its own handle", async () => {
    expect((await call("PATCH", "/me", { handle: "mom" }, await momPhone())).status).toBe(200);
  });

  it("refuses another profile's handle", async () => {
    const r = await call("PATCH", "/me", { handle: "jonathan.m" }, await momPhone());
    expect(r.status).toBe(409);
    expect(errorCode(r)).toBe("handle_taken");
  });

  it("refuses an invalid edit", async () => {
    const r = await call("PATCH", "/me", { name: "" }, await momPhone());
    expect(r.status).toBe(400);
    expect(errorCode(r)).toBe("invalid_body");
  });

  it.each([
    [
      "a launcher token",
      () => tokenFor({ sub: "mom", did: "tv", kind: "launcher", sid: "s" }),
      403,
      "profile_token_required",
    ],
    [
      "a deleted profile's token",
      () => tokenFor({ sub: "gone", did: "p", kind: "phone" }),
      404,
      "profile_not_found",
    ],
    ["no token", async () => undefined, 401, "missing_auth"],
    ["a non-Bearer header", async () => "x", 401, "invalid_auth"],
  ])("refuses %s", async (label, token, status, code) => {
    const t = await token();
    const headers: Record<string, string> = {};
    if (t) headers.Authorization = label === "a non-Bearer header" ? "Basic x" : `Bearer ${t}`;
    const res = await app.request("/api/v1/me", { method: "PATCH", headers, body: "{}" }, env());
    expect(res.status).toBe(status);
    expect(errorCode({ body: Body.parse(await res.json()) })).toBe(code);
  });
});
