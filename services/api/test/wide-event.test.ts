import type { Claims } from "@open-game-system/ogs-protocol";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import { errorFields, scrub } from "../src/lib/wide-event";
import { openTestD1, type TestD1 } from "./support/d1";

/**
 * One wide event per HTTP request (docs/agents/observability.md): `console.info(obj)` when it
 * went well, `console.error(obj)` with `error: { type, message, stack }` when it threw or
 * answered 5xx. Ids go in fields; names, emails and tokens never reach the line.
 */
const SECRET = "wide-event-secret";
const VERSION = { id: "v-123", tag: "", timestamp: "2026-10-05T00:00:00Z" };

let d1: TestD1;
beforeAll(async () => {
  d1 = await openTestD1();
});
afterAll(() => d1.dispose());
beforeEach(async () => {
  await d1.reset();
  await d1.db
    .prepare(
      "INSERT INTO profiles (id, handle, name, sticker) VALUES ('mom', 'mommy', 'Secret Mom Name', 'sun')",
    )
    .run();
});
afterEach(() => vi.restoreAllMocks());

const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });

const Line = z.object({
  event: z.string(),
  service: z.string(),
  version: z.string(),
  source: z.literal("server"),
  outcome: z.enum(["ok", "error"]),
  duration_ms: z.number(),
  request_id: z.string(),
  method: z.string(),
  route: z.string(),
  status: z.number(),
});
const ErrorLine = Line.extend({
  error: z.object({ type: z.string(), message: z.string(), stack: z.string().optional() }),
});

function spies() {
  return {
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

const request = (path: string, init: RequestInit, env: Record<string, unknown>) =>
  app.request(path, init, { OGS_JWT_SECRET: SECRET, CF_VERSION_METADATA: VERSION, ...env });

describe("http.request wide event", () => {
  it("a request that goes well is one console.info line: route pattern, status, version, profile id", async () => {
    const s = spies();
    const token = await tokenFor({ sub: "mom", did: "mom-phone", kind: "phone" });
    const res = await request(
      "/api/v1/me",
      { headers: { Authorization: `Bearer ${token}`, "cf-ray": "ray-1" } },
      { DB: d1.db },
    );
    expect(res.status).toBe(200);
    expect(s.info).toHaveBeenCalledTimes(1);
    expect(s.error).not.toHaveBeenCalled();
    const line = Line.passthrough().parse(s.info.mock.calls[0][0]);
    expect(line).toMatchObject({
      event: "http.request",
      service: "opengame-api",
      version: "v-123",
      outcome: "ok",
      request_id: "ray-1",
      method: "GET",
      route: "/api/v1/me",
      status: 200,
      profile_id: "mom",
      device_kind: "phone",
    });
    const text = JSON.stringify(line);
    expect(text).not.toContain(token);
    expect(text).not.toContain("Secret Mom Name");
  });

  it("logs the route pattern, not the path with its ids", async () => {
    const s = spies();
    await request("/api/v1/sessions/sess-42", {}, { DB: d1.db });
    const line = Line.parse(s.info.mock.calls[0][0]);
    expect(line.route).toBe("/api/v1/sessions/:sid");
  });

  it("a handler that throws is exactly one console.error line with error.type/message/stack", async () => {
    const s = spies();
    const token = await tokenFor({ sub: "mom", did: "mom-phone", kind: "phone" });
    const broken = {
      prepare() {
        throw new TypeError("D1 is down for a@example.com");
      },
    };
    const res = await request(
      "/api/v1/me",
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: broken },
    );
    expect(res.status).toBe(500);
    // The API's error contract, not Hono's plain-text 500.
    expect(await res.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong", status: 500 },
    });
    expect(s.error).toHaveBeenCalledTimes(1);
    expect(s.info).not.toHaveBeenCalled();
    const line = ErrorLine.parse(s.error.mock.calls[0][0]);
    expect(line).toMatchObject({
      event: "http.request",
      outcome: "error",
      status: 500,
      route: "/api/v1/me",
      error: { type: "TypeError", message: "D1 is down for [email]" },
    });
    expect(line.error.stack).toContain("TypeError");
    expect(JSON.stringify(line)).not.toContain("a@example.com");
    expect(JSON.stringify(line)).not.toContain(token);
  });

  it("a handled failure answered 5xx is one console.error line with the recorded error", async () => {
    const s = spies();
    const send: SendEmail = {
      async send() {
        throw new Error("E_SENDER_NOT_VERIFIED for kid@example.com");
      },
    };
    const res = await request(
      "/api/v1/auth/email/start",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "kid@example.com" }),
      },
      { DB: d1.db, SEND_EMAIL: send, EMAIL_FROM: "sign-in@opengame.org" },
    );
    expect(res.status).toBe(502);
    expect(s.error).toHaveBeenCalledTimes(1);
    const line = ErrorLine.parse(s.error.mock.calls[0][0]);
    expect(line).toMatchObject({
      outcome: "error",
      status: 502,
      error: { type: "Error", message: "E_SENDER_NOT_VERIFIED for [email]" },
    });
    expect(JSON.stringify(line)).not.toContain("kid@example.com");
  });

  it("a 5xx with no recorded error still says what failed, without ids in the message", async () => {
    const s = spies();
    // /stream/ready answers 503 when nothing is configured.
    const res = await request("/api/v1/stream/ready", {}, {});
    expect(res.status).toBe(503);
    const line = ErrorLine.parse(s.error.mock.calls[0][0]);
    expect(line.error).toEqual({ type: "HttpError", message: "503 GET /api/v1/stream/ready" });
  });

  it("4xx answers are the client's problem: info, not error", async () => {
    const s = spies();
    const res = await request("/api/v1/me", {}, { DB: d1.db });
    expect(res.status).toBe(401);
    expect(s.error).not.toHaveBeenCalled();
    expect(Line.parse(s.info.mock.calls[0][0])).toMatchObject({ outcome: "ok", status: 401 });
  });

  it("without the version binding (local dev) the version is 'dev'", async () => {
    const s = spies();
    await app.request("/api/v1/health", {}, {});
    expect(Line.parse(s.info.mock.calls[0][0]).version).toBe("dev");
  });
});

describe("errorFields", () => {
  it("reads an Error's class and message", () => {
    const e = new RangeError("too far");
    expect(errorFields(e)).toMatchObject({ type: "RangeError", message: "too far" });
  });

  it("a string or another value becomes a message with a stable type", () => {
    expect(errorFields("boom")).toEqual({ type: "Error", message: "boom" });
    expect(errorFields({ code: 7 })).toEqual({ type: "NonError", message: '{"code":7}' });
  });
});

describe("scrub", () => {
  it("takes out emails, JWTs, token= values and bearer tokens", () => {
    expect(
      scrub("to a.b@x.org at /ws?token=abc&x=1 with eyJhbGc.eyJzdWI.sig and Bearer s3cr3t"),
    ).toBe("to [email] at /ws?token=REDACTED&x=1 with REDACTED and Bearer REDACTED");
  });
});
