import type { Claims } from "@open-game-system/ogs-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";
import { issueToken } from "../src/lib/identity";
import { memoryClientLogNamespace } from "./support/client-log-memory";

/**
 * The stored client log (docs/agents/client-log.md): POST /api/v1/client-events also keeps the
 * last events of each app launch, and GET /api/v1/client-events reads them back with the log key
 * (x-log-key). Same lines as Workers Logs, so the same redaction.
 */
const SECRET = "client-log-secret";
const KEY = "log-key-for-tests";

const tokenFor = (claims: Omit<Claims, "exp">) =>
  issueToken(claims, SECRET, { now: Date.now(), ttlSeconds: 60 });
const phone = () => tokenFor({ sub: "mom", did: "mom-phone", kind: "phone" });

let ns: ReturnType<typeof memoryClientLogNamespace>;
const env = (over: Record<string, unknown> = {}) => ({
  OGS_JWT_SECRET: SECRET,
  CLIENT_LOG: ns,
  CLIENT_LOG_KEY: KEY,
  ...over,
});

beforeEach(() => {
  ns = memoryClientLogNamespace();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const event = (over: Record<string, unknown> = {}) => ({
  name: "native.display.attach",
  at: 1_700_000_000_000,
  level: "info",
  ...over,
});
const shellContext = (over: Record<string, unknown> = {}) => ({
  app: "shell",
  appId: "settlewood",
  launchId: "launch-abc123",
  build: "7",
  version: "1.0.0",
  platform: "ios 26.4",
  ...over,
});

async function post(body: unknown, envOver: Record<string, unknown> = {}) {
  const res = await app.request(
    "/api/v1/client-events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await phone()}` },
      body: JSON.stringify(body),
    },
    env(envOver),
  );
  return res.status;
}

async function get(query: string, key: string | null = KEY, envOver: Record<string, unknown> = {}) {
  const headers: Record<string, string> = {};
  if (key !== null) headers["x-log-key"] = key;
  const res = await app.request(`/api/v1/client-events${query}`, { headers }, env(envOver));
  return { status: res.status, body: z.unknown().parse(await res.json()) };
}

const EventsBody = z.object({
  bucket: z.string(),
  events: z.array(z.record(z.string(), z.unknown())),
});
const BucketsBody = z.object({
  buckets: z.array(
    z.object({
      bucket: z.string(),
      source: z.string(),
      appId: z.string().nullable(),
      profileId: z.string().nullable(),
      deviceHash: z.string().nullable(),
      sessionId: z.string().nullable(),
      build: z.string().nullable(),
      firstAt: z.number(),
      lastAt: z.number(),
      count: z.number(),
    }),
  ),
});

describe("POST /api/v1/client-events keeps a copy per launch", () => {
  it("a game's own app (app: shell) is accepted with its appId and launch id, and logged with them", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await post({ context: shellContext(), events: [event()] })).toBe(202);
    const line = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(String(log.mock.calls[0]?.[0])));
    expect(line).toMatchObject({
      source: "shell",
      appId: "settlewood",
      launchId: "launch-abc123",
      name: "native.display.attach",
      profileId: "mom",
    });
  });

  it("reads back a launch's events, oldest first, redacted like the log line", async () => {
    await post({
      context: shellContext(),
      events: [
        event({ data: { w: 1920 } }),
        event({
          name: "native.tv_webview.fail",
          level: "error",
          error: "load failed https://ogs-tv.pages.dev/?token=eyJabc.def.ghi",
          data: { url: "ogs-tv.pages.dev/", token: "never" },
        }),
      ],
    });
    await post({ context: shellContext(), events: [event({ name: "airplay.connected" })] });
    const r = await get("?launch=launch-abc123");
    expect(r.status).toBe(200);
    const body = EventsBody.parse(r.body);
    expect(body.bucket).toBe("launch:launch-abc123");
    expect(body.events.map((e) => e.name)).toEqual([
      "native.display.attach",
      "native.tv_webview.fail",
      "airplay.connected",
    ]);
    expect(body.events[0]).toMatchObject({
      data: { w: 1920 },
      profileId: "mom",
      appId: "settlewood",
    });
    expect(body.events[1]?.error).toBe("load failed https://ogs-tv.pages.dev/?token=REDACTED");
    expect(body.events[1]?.data).toEqual({ url: "ogs-tv.pages.dev/" });
    expect(
      EventsBody.parse((await get("?launch=launch-abc123&limit=1")).body).events.map((e) => e.name),
    ).toEqual(["airplay.connected"]);
  });

  it("a build without a launch id is kept under its profile", async () => {
    await post({
      context: { app: "mobile", build: "41" },
      events: [event({ name: "cast.start" })],
    });
    const body = EventsBody.parse((await get("?bucket=profile:mom")).body);
    expect(body.events.map((e) => e.name)).toEqual(["cast.start"]);
  });

  it("lists recent launches, newest first, and filters them", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await post({
      context: shellContext({ launchId: "launch-1", deviceHash: "h:aa" }),
      events: [event(), event()],
    });
    now = 2_000;
    await post({
      context: { app: "mobile", launchId: "launch-2", deviceHash: "h:bb", sessionId: "couch-9" },
      events: [event()],
    });
    now = 3_000;
    await post({
      context: shellContext({ launchId: "launch-1", deviceHash: "h:aa" }),
      events: [event()],
    });

    const all = BucketsBody.parse((await get("")).body).buckets;
    expect(all.map((b) => b.bucket)).toEqual(["launch:launch-1", "launch:launch-2"]);
    expect(all[0]).toEqual({
      bucket: "launch:launch-1",
      source: "shell",
      appId: "settlewood",
      profileId: "mom",
      deviceHash: "h:aa",
      sessionId: null,
      build: "7",
      firstAt: 1_000,
      lastAt: 3_000,
      count: 3,
    });
    const pick = async (q: string) =>
      BucketsBody.parse((await get(q)).body).buckets.map((b) => b.bucket);
    expect(await pick("?app=mobile")).toEqual(["launch:launch-2"]);
    expect(await pick("?appId=settlewood")).toEqual(["launch:launch-1"]);
    expect(await pick("?device=h:bb")).toEqual(["launch:launch-2"]);
    expect(await pick("?session=couch-9")).toEqual(["launch:launch-2"]);
    expect(await pick("?profile=mom")).toEqual(["launch:launch-1", "launch:launch-2"]);
    expect(await pick("?profile=dad")).toEqual([]);
  });

  it("a store that fails never fails the post (the log line is already written)", async () => {
    const broken = {
      idFromName: (name: string) => name,
      get: () => ({
        append: async () => {
          throw new Error("storage down");
        },
        touch: async () => {},
      }),
    };
    expect(await post({ context: shellContext(), events: [event()] }, { CLIENT_LOG: broken })).toBe(
      202,
    );
  });

  it("without the binding nothing is stored and the post still works", async () => {
    expect(
      await post({ context: shellContext(), events: [event()] }, { CLIENT_LOG: undefined }),
    ).toBe(202);
  });
});

describe("GET /api/v1/client-events needs the log key", () => {
  it("refuses a missing or wrong key, and any key while none is configured", async () => {
    await post({ context: shellContext(), events: [event()] });
    for (const r of [
      await get("?launch=launch-abc123", null),
      await get("?launch=launch-abc123", "wrong"),
      await get("?launch=launch-abc123", KEY, { CLIENT_LOG_KEY: undefined }),
      await get("?launch=launch-abc123", "", { CLIENT_LOG_KEY: "" }),
    ]) {
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({ error: { code: "forbidden", status: 403 } });
    }
  });

  it("never takes the key from the query string", async () => {
    const r = await get(`?launch=launch-abc123&key=${KEY}`, null);
    expect(r.status).toBe(403);
  });

  it("answers 400 for a bad query, 503 without the store", async () => {
    expect((await get("?limit=0")).status).toBe(400);
    expect((await get("?limit=501")).status).toBe(400);
    expect((await get("?launch=has spaces")).status).toBe(400);
    expect((await get("?bucket=nope")).status).toBe(400);
    expect((await get("", KEY, { CLIENT_LOG: undefined })).status).toBe(503);
  });

  it("an unknown launch has no events", async () => {
    const body = EventsBody.parse((await get("?launch=launch-none")).body);
    expect(body).toEqual({ bucket: "launch:launch-none", events: [] });
  });
});
