import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { openTestD1, type TestD1 } from "./support/d1";

/**
 * The beta release record (docs/acceptance/2026-10-07-beta-distribution.feature): CI records each
 * platform's latest build; the app reads it and asks older builds to update.
 */
const TOKEN = "release-token-for-tests";
const TESTFLIGHT = "https://testflight.apple.com/join/XYZ";

let d1: TestD1;
beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(() => d1.reset());

const env = (over: Record<string, unknown> = {}) => ({ DB: d1.db, RELEASE_TOKEN: TOKEN, ...over });

const ReleaseSchema = z.object({
  platform: z.string(),
  build: z.number(),
  fingerprint: z.string(),
  updateUrl: z.string(),
  updatedAt: z.number(),
});
const ErrorSchema = z.object({ error: z.object({ code: z.string(), status: z.number() }) });

async function get(platform: string, envOver: Record<string, unknown> = {}) {
  const res = await app.request(`/api/v1/app-release/${platform}`, {}, env(envOver));
  return { status: res.status, body: z.unknown().parse(await res.json()) };
}

async function put(
  platform: string,
  body: unknown,
  opts: { token?: string | null; envOver?: Record<string, unknown> } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = opts.token === undefined ? TOKEN : opts.token;
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(
    `/api/v1/app-release/${platform}`,
    { method: "PUT", headers, body: JSON.stringify(body) },
    env(opts.envOver),
  );
  return { status: res.status, body: z.unknown().parse(await res.json()) };
}

const release = (over: Record<string, unknown> = {}) => ({
  build: 12,
  fingerprint: "abc",
  updateUrl: TESTFLIGHT,
  ...over,
});
const codeOf = (r: { body: unknown }) => ErrorSchema.parse(r.body).error.code;

describe("GET /api/v1/app-release/:platform", () => {
  it("answers 404 not_found when no release is recorded", async () => {
    const r = await get("ios");
    expect(r.status).toBe(404);
    expect(codeOf(r)).toBe("not_found");
  });

  it("answers 400 invalid_platform for anything but ios and android", async () => {
    const r = await get("web");
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("invalid_platform");
  });

  it("needs no token", async () => {
    await put("ios", release());
    const r = await get("ios");
    expect(r.status).toBe(200);
  });
});

describe("PUT /api/v1/app-release/:platform", () => {
  it("records the release and GET answers it", async () => {
    const before = Date.now();
    const w = await put("ios", release());
    expect(w.status).toBe(200);
    const r = await get("ios");
    const body = ReleaseSchema.parse(r.body);
    expect(body).toMatchObject({
      platform: "ios",
      build: 12,
      fingerprint: "abc",
      updateUrl: TESTFLIGHT,
    });
    expect(body.updatedAt).toBeGreaterThanOrEqual(before);
    expect(ReleaseSchema.parse(w.body)).toEqual(body);
  });

  it("keeps platforms separate", async () => {
    await put("ios", release());
    expect((await get("android")).status).toBe(404);
  });

  it("refuses a missing token with 401 unauthorized and changes nothing", async () => {
    const r = await put("ios", release(), { token: null });
    expect(r.status).toBe(401);
    expect(codeOf(r)).toBe("unauthorized");
    expect((await get("ios")).status).toBe(404);
  });

  it("refuses a wrong token", async () => {
    const r = await put("ios", release(), { token: "nope" });
    expect(r.status).toBe(401);
    expect(codeOf(r)).toBe("unauthorized");
  });

  it("refuses every token when RELEASE_TOKEN is not set", async () => {
    const r = await put("ios", release(), { envOver: { RELEASE_TOKEN: undefined } });
    expect(r.status).toBe(401);
    const empty = await put("ios", release(), { token: "", envOver: { RELEASE_TOKEN: "" } });
    expect(empty.status).toBe(401);
  });

  it("refuses an older build with 409 stale_build and keeps the newer one", async () => {
    await put("ios", release({ build: 12 }));
    const r = await put("ios", release({ build: 11, fingerprint: "old" }));
    expect(r.status).toBe(409);
    expect(codeOf(r)).toBe("stale_build");
    expect(ReleaseSchema.parse((await get("ios")).body).build).toBe(12);
  });

  it("accepts the same build again (a re-run) and a newer build", async () => {
    await put("ios", release({ build: 12 }));
    expect((await put("ios", release({ build: 12, fingerprint: "abc2" }))).status).toBe(200);
    expect((await put("ios", release({ build: 13, fingerprint: "def" }))).status).toBe(200);
    expect(ReleaseSchema.parse((await get("ios")).body)).toMatchObject({
      build: 13,
      fingerprint: "def",
    });
  });

  it.each([
    ["a zero build", release({ build: 0 })],
    ["a fractional build", release({ build: 1.5 })],
    ["a string build", release({ build: "12" })],
    ["an empty fingerprint", release({ fingerprint: "" })],
    ["an http update URL", release({ updateUrl: "http://example.com" })],
    ["a non-URL update URL", release({ updateUrl: "testflight" })],
    ["no update URL", { build: 12, fingerprint: "abc" }],
  ])("refuses %s with 400 invalid_body", async (_name, body) => {
    const r = await put("ios", body);
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("invalid_body");
  });

  it("refuses an unknown platform with 400 invalid_platform", async () => {
    const r = await put("web", release());
    expect(r.status).toBe(400);
    expect(codeOf(r)).toBe("invalid_platform");
  });
});
