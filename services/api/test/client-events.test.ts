import type { Claims } from "@open-game-system/ogs-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";

/**
 * POST /api/v1/client-events: the app (and the cast receiver) send their wide events; each one
 * becomes one JSON line in Workers Logs (console.log, console.error for errors).
 */
const SECRET = "client-events-secret";

const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phone = () => tokenFor({ sub: "mom", did: "mom-phone", kind: "phone" });

type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };
const allow: Limiter = { limit: async () => ({ success: true }) };

function env(limiter: Limiter = allow) {
  return { OGS_JWT_SECRET: SECRET, CLIENT_EVENTS_LIMITER: limiter };
}

async function post(body: unknown, opts: { token?: string; limiter?: Limiter; raw?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await app.request(
    "/api/v1/client-events",
    { method: "POST", headers, body: opts.raw ?? JSON.stringify(body) },
    env(opts.limiter),
  );
  return { status: res.status, body: z.unknown().parse(await res.json()) };
}
const errorOf = (r: { body: unknown }) =>
  z.object({ error: z.object({ code: z.string(), status: z.number() }) }).parse(r.body).error;

const event = (over: Record<string, unknown> = {}) => ({
  name: "cast.start.resolved",
  at: 1_700_000_000_000,
  level: "info",
  ...over,
});
const context = (over: Record<string, unknown> = {}) => ({
  app: "mobile",
  build: "42",
  version: "1.2.0",
  platform: "ios 18.1",
  sessionId: "couch-1",
  ...over,
});

function lines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((c) =>
    z.record(z.string(), z.unknown()).parse(JSON.parse(String(c[0]))),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/v1/client-events", () => {
  it("writes each event as one JSON line with the batch context and the token's profile", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await post(
      {
        context: context({ profileId: "someone-else" }),
        events: [
          event({ attemptId: "a1", durationMs: 120, data: { result: true, tv: "h:1f" } }),
          event({ name: "cast.discovery.updated", data: { count: 2 } }),
        ],
      },
      { token: await phone() },
    );
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ accepted: 2 });
    const out = lines(log);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      kind: "client_event",
      source: "mobile",
      authenticated: true,
      // The token's profile, never the one the client claims.
      profileId: "mom",
      build: "42",
      version: "1.2.0",
      platform: "ios 18.1",
      sessionId: "couch-1",
      name: "cast.start.resolved",
      level: "info",
      at: 1_700_000_000_000,
      attemptId: "a1",
      durationMs: 120,
      data: { result: true, tv: "h:1f" },
    });
    expect(typeof out[0].receivedAt).toBe("number");
    expect(out[1]).toMatchObject({ name: "cast.discovery.updated", data: { count: 2 } });
  });

  it("an error event carries errorType for sre-agent: the client's, else the event's name", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await post(
      {
        context: context(),
        events: [
          event({
            name: "app.js_error",
            level: "error",
            error: "x is undefined",
            errorType: "TypeError",
            errorStack: "TypeError: x is undefined\n  at a (http://app/?token=abc:1:2)",
          }),
          // An older build (no errorType): the event's name is the type.
          event({ name: "cast.start.rejected", level: "error", error: "No device" }),
        ],
      },
      { token: await phone() },
    );
    const out = lines(err);
    expect(out[0]).toMatchObject({
      error: "x is undefined",
      errorType: "TypeError",
      // token= values are redacted up to the next & # space or quote.
      errorStack: "TypeError: x is undefined\n  at a (http://app/?token=REDACTED",
    });
    expect(out[1]).toMatchObject({ error: "No device", errorType: "cast.start.rejected" });
    expect(out[1]).not.toHaveProperty("errorStack");
  });

  it("info events carry no errorType", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await post({ context: context(), events: [event()] }, { token: await phone() });
    expect(lines(log)[0]).not.toHaveProperty("errorType");
  });

  it("an email in an error's text never reaches the log", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await post(
      {
        context: context(),
        events: [event({ level: "error", error: "sign-in failed for kid@example.com" })],
      },
      { token: await phone() },
    );
    expect(String(err.mock.calls[0][0])).not.toContain("kid@example.com");
  });

  it("an error event goes to console.error (Workers Logs' error level), with its message", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await post(
      {
        context: context(),
        events: [event({ name: "cast.start.rejected", level: "error", error: "boom" })],
      },
      { token: await phone() },
    );
    expect(log).not.toHaveBeenCalled();
    expect(lines(err)[0]).toMatchObject({ name: "cast.start.rejected", error: "boom" });
  });

  it("each line has a message without ids (Workers Logs' message, the SRE agent's fingerprint)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await post(
      {
        context: context(),
        events: [
          event({ attemptId: "a1", data: { tv: "h:1" } }),
          event({ name: "cast.start.rejected", level: "error", error: "No device" }),
        ],
      },
      { token: await phone() },
    );
    expect(lines(log)[0].message).toBe("client mobile cast.start.resolved");
    expect(lines(err)[0].message).toBe("client mobile cast.start.rejected: No device");
  });

  it("never writes a token: token= in URLs and JWT-looking strings are redacted, secret-named keys dropped", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const jwt = await phone();
    await post(
      {
        context: context(),
        events: [
          event({
            error: `failed at http://tv/?api=x&token=${jwt}`,
            data: { viewUrl: `http://tv/?token=abc.def&api=1`, launcherToken: "x", raw: jwt },
          }),
        ],
      },
      { token: jwt },
    );
    const text = String(log.mock.calls[0][0]);
    expect(text).not.toContain(jwt);
    expect(text).not.toContain("abc.def");
    expect(lines(log)[0]).toMatchObject({
      error: "failed at http://tv/?api=x&token=REDACTED",
      data: { viewUrl: "http://tv/?token=REDACTED&api=1", raw: "REDACTED" },
    });
    expect(lines(log)[0].data).not.toHaveProperty("launcherToken");
  });

  it("the cast receiver may post without a token (it has none); marked unauthenticated", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await post({
      context: { app: "receiver", version: "receiver" },
      events: [event({ name: "receiver.load_view" })],
    });
    expect(r.status).toBe(202);
    expect(lines(log)[0]).toMatchObject({
      source: "receiver",
      authenticated: false,
      name: "receiver.load_view",
    });
    expect(lines(log)[0]).not.toHaveProperty("profileId");
  });

  it("a receiver event carries the phone's attempt id and the couch session it got in LOAD_VIEW", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await post({
      context: { app: "receiver", version: "receiver-2026-10-10b" },
      events: [
        event({
          name: "receiver.load_view.received",
          attemptId: "rx-1",
          phoneAttemptId: "mhx-21cf-6",
          sessionId: "couch-7",
        }),
        event({ name: "receiver.launched", attemptId: "rx-1" }),
      ],
    });
    expect(r.status).toBe(202);
    const [joined, launched] = lines(log);
    // Joins the phone's line: its attemptId is phoneAttemptId here, the same sessionId.
    expect(joined).toMatchObject({
      attemptId: "rx-1",
      phoneAttemptId: "mhx-21cf-6",
      sessionId: "couch-7",
    });
    expect(launched).not.toHaveProperty("phoneAttemptId");
    expect(launched).not.toHaveProperty("sessionId");
  });

  it("an event's own sessionId wins over the batch's (the receiver's changes with each LOAD_VIEW)", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await post(
      { context: context({ sessionId: "couch-1" }), events: [event({ sessionId: "couch-2" })] },
      { token: await phone() },
    );
    expect(lines(log)[0]).toMatchObject({ sessionId: "couch-2" });
  });

  it("join ids are parsed at the boundary: longer than 64 is 400 invalid_body", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await post({
      context: { app: "receiver" },
      events: [event({ name: "receiver.launched", phoneAttemptId: "x".repeat(65) })],
    });
    expect(r.status).toBe(400);
    expect(errorOf(r).code).toBe("invalid_body");
    expect(log).not.toHaveBeenCalled();
  });

  it("the app must send its token: 401 missing_auth", async () => {
    const r = await post({ context: context(), events: [event()] });
    expect(r.status).toBe(401);
    expect(errorOf(r)).toEqual({ code: "missing_auth", status: 401 });
  });

  it("a bad token is 401 invalid_token, even for the receiver", async () => {
    const r = await post(
      { context: { app: "receiver" }, events: [event()] },
      { token: "not-a-token" },
    );
    expect(r.status).toBe(401);
    expect(errorOf(r).code).toBe("invalid_token");
  });

  it("parses at the boundary: a bad batch is 400 invalid_body and logs nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const token = await phone();
    for (const body of [
      { context: context(), events: [] },
      { context: context(), events: [event({ level: "fatal" })] },
      { context: context(), events: [event({ name: "has spaces" })] },
      { context: { app: "web" }, events: [event()] },
      { events: [event()] },
      { context: context(), events: Array.from({ length: 51 }, () => event()) },
      { context: context(), events: [event({ data: { nested: { a: 1 } } })] },
    ]) {
      const r = await post(body, { token });
      expect(r.status).toBe(400);
      expect(errorOf(r).code).toBe("invalid_body");
    }
    const r = await post(null, { token, raw: "{not json" });
    expect(errorOf(r).code).toBe("invalid_body");
    expect(log).not.toHaveBeenCalled();
  });

  it("a batch over 64 KB is 413 payload_too_large", async () => {
    const r = await post(
      { context: context(), events: [event({ error: "x".repeat(70_000) })] },
      { token: await phone() },
    );
    expect(r.status).toBe(413);
    expect(errorOf(r)).toMatchObject({ code: "payload_too_large", status: 413 });
  });

  it("rate limited per profile (the receiver per IP): 429 rate_limited", async () => {
    const keys: string[] = [];
    const deny: Limiter = {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: false };
      },
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await post(
      { context: context(), events: [event()] },
      { token: await phone(), limiter: deny },
    );
    expect(r.status).toBe(429);
    expect(errorOf(r)).toMatchObject({ code: "rate_limited", status: 429 });
    await post({ context: { app: "receiver" }, events: [event()] }, { limiter: deny });
    expect(keys).toEqual(["profile:mom", "receiver:unknown"]);
    expect(log).not.toHaveBeenCalled();
  });
});
