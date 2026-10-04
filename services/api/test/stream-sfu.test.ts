import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import app from "../src/index";

/**
 * The SFU flow routes (start-stream, subscribe, subscribe answer, ice-servers) against a fake
 * world: Cloudflare TURN + Realtime APIs and the stream server, all behind a stubbed fetch.
 */
const RTC = "https://rtc.live.cloudflare.com/v1";
const SFU = `${RTC}/apps/app-1/sessions`;
const TURN = `${RTC}/turn/keys/turn-key/credentials/generate-ice-servers`;
const SERVER = "https://stream.example";
const OFFER = { type: "offer", sdp: "v=0 local" };
const TRACKS = [
  { location: "local", trackName: "cast-video", mid: "0" },
  { location: "local", trackName: "cast-audio", mid: "1" },
];

type Call = { url: string; method: string; body: unknown };
type Handler = (call: Call) => Response | undefined;

let calls: Call[];
let override: Handler;
let doCalls: Call[];

const json = (value: unknown, status = 200) => Response.json(value, { status });

/** The default, happy world. `override` answers first when it returns a response. */
function world(call: Call): Response {
  const special = override(call);
  if (special) return special;
  if (call.url === TURN)
    return json({
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478", "turn:turn.cloudflare.com:53?transport=udp"] },
        { urls: "turn:turn.cloudflare.com:53" },
      ],
    });
  if (call.url.endsWith("/publisher/prepare"))
    return json({ sessionDescription: OFFER, tracks: TRACKS, traceId: "t" });
  if (call.url.endsWith("/publisher/answer")) return json({ ok: true });
  if (call.url.endsWith("/debug-state")) return json({ publisher: "idle" });
  if (call.url === `${SFU}/new`)
    return json(
      call.body
        ? { sessionId: "pub-1", sessionDescription: { type: "answer", sdp: "sfu answer" } }
        : { sessionId: "sub-1" },
    );
  if (call.url.endsWith("/tracks/new"))
    return json({ sessionDescription: { type: "offer", sdp: `tracks for ${call.url}` } });
  if (call.url.endsWith("/renegotiate"))
    return json({ sessionDescription: { type: "answer", sdp: "renegotiated" } });
  return json({ error: "unexpected" }, 599);
}

async function record(input: RequestInfo | URL, init?: RequestInit, into = calls) {
  const req = new Request(input, init);
  const text = await req.text();
  const call = { url: req.url, method: req.method, body: text ? JSON.parse(text) : undefined };
  into.push(call);
  return world(call);
}

beforeEach(() => {
  calls = [];
  doCalls = [];
  override = () => undefined;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => record(input, init));
  // start-stream waits 5 s for the PeerConnection; run it at once.
  vi.stubGlobal("setTimeout", (fn: () => void) => {
    fn();
    return 0;
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function env(over: Record<string, unknown> = {}) {
  return {
    CLOUDFLARE_REALTIME_APP_ID: "app-1",
    CLOUDFLARE_REALTIME_APP_SECRET: "secret-1",
    CLOUDFLARE_TURN_API_TOKEN: "turn-token",
    CLOUDFLARE_TURN_KEY_ID: "turn-key",
    STREAM_CONTAINER: {
      idFromName: (name: string) => ({ name }),
      get: (id: { name: string }) => ({
        fetch: (req: Request) =>
          record(req, undefined, doCalls).then((r) => {
            doCalls[doCalls.length - 1].url = `${id.name}${new URL(req.url).pathname}`;
            return r;
          }),
      }),
    },
    ...over,
  };
}

async function send(
  method: string,
  path: string,
  body?: unknown,
  e = env(),
  headers: Record<string, string> = {},
) {
  const res = await app.request(
    `/api/v1/stream${path}`,
    {
      method,
      headers: { "Content-Type": "application/json", "x-stream-trace-id": "trace-1", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    e,
  );
  return { status: res.status, body: z.record(z.string(), z.unknown()).parse(await res.json()) };
}

const urls = (list: Call[]) => list.map((c) => `${c.method} ${c.url}`);

describe("POST /stream/start-stream", () => {
  it("prepares the publisher, opens an SFU session, answers, adds tracks and re-answers (direct server)", async () => {
    const r = await send(
      "POST",
      "/start-stream",
      { url: "https://game.example/tv" },
      env({ STREAM_SERVER_URL: SERVER }),
    );
    expect(r).toEqual({
      status: 200,
      body: { status: "success", traceId: "trace-1", publisherSessionId: "pub-1", tracks: TRACKS },
    });
    expect(urls(calls)).toEqual([
      `POST ${TURN}`,
      `POST ${SERVER}/publisher/prepare`,
      `POST ${SFU}/new`,
      `POST ${SERVER}/publisher/answer`,
      `POST ${SFU}/pub-1/tracks/new`,
      `POST ${SERVER}/publisher/answer`,
    ]);
    // Port-53 TURN urls are dropped; a server left with none is dropped.
    expect(calls[1].body).toEqual({
      url: "https://game.example/tv",
      iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
    });
    expect(calls[2].body).toEqual({ sessionDescription: OFFER });
    expect(calls[3].body).toEqual({ sessionDescription: { type: "answer", sdp: "sfu answer" } });
    expect(calls[4].body).toEqual({
      sessionDescription: OFFER,
      tracks: [
        { location: "local", trackName: "cast-video", mid: "0" },
        { location: "local", trackName: "cast-audio", mid: "1" },
      ],
    });
    expect(calls[5].body).toEqual({
      sessionDescription: { type: "offer", sdp: `tracks for ${SFU}/pub-1/tracks/new` },
    });
  });

  it("goes through the session's stream container without STREAM_SERVER_URL, with no TURN when unconfigured", async () => {
    const e = env({ CLOUDFLARE_TURN_API_TOKEN: undefined });
    const r = await send("POST", "/start-stream", { url: "u" }, e, {
      "x-stream-session-id": " cast-1 ",
    });
    expect(r.status).toBe(200);
    expect(urls(doCalls)).toEqual([
      "POST session-cast-1/publisher/prepare",
      "POST session-cast-1/publisher/answer",
      "POST session-cast-1/publisher/answer",
    ]);
    expect(doCalls[0].body).toEqual({ url: "u", iceServers: [] });
  });

  it("uses the debug singleton container without a session id", async () => {
    await send("POST", "/start-stream", { url: "u" }, env({ CLOUDFLARE_TURN_KEY_ID: undefined }));
    expect(doCalls[0].url).toBe("default-singleton-debug-v3/publisher/prepare");
  });

  it("always re-answers with what adding tracks returned (the SFU always returns a description)", async () => {
    override = (c) =>
      c.url.endsWith("/tracks/new")
        ? json({ sessionDescription: { type: "offer", sdp: "" } })
        : undefined;
    const r = await send("POST", "/start-stream", { url: "u" }, env({ STREAM_SERVER_URL: SERVER }));
    expect(r.status).toBe(200);
    const answers = calls.filter((c) => c.url.endsWith("/publisher/answer"));
    expect(answers.map((a) => a.body)).toEqual([
      { sessionDescription: { type: "answer", sdp: "sfu answer" } },
      { sessionDescription: { type: "offer", sdp: "" } },
    ]);
  });

  it("answers 500 when adding tracks returns no description", async () => {
    override = (c) => (c.url.endsWith("/tracks/new") ? json({ tracks: [] }) : undefined);
    const r = await send("POST", "/start-stream", { url: "u" }, env({ STREAM_SERVER_URL: SERVER }));
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/addTracks: unexpected response/);
  });

  it("carries on with no ICE servers when TURN refuses", async () => {
    override = (c) => (c.url === TURN ? json({ nope: true }, 500) : undefined);
    const r = await send("POST", "/start-stream", { url: "u" }, env({ STREAM_SERVER_URL: SERVER }));
    expect(r.status).toBe(200);
    expect(calls[1].body).toEqual({ url: "u", iceServers: [] });
  });

  it.each([
    ["prepare", "/publisher/prepare", "Publisher prepare failed"],
    ["answer", "/publisher/answer", "Publisher answer failed"],
  ])("reports a failed publisher %s with the server's words", async (_label, path, error) => {
    override = (c) =>
      c.url.endsWith(path) ? new Response("chrome crashed", { status: 503 }) : undefined;
    const r = await send("POST", "/start-stream", { url: "u" }, env({ STREAM_SERVER_URL: SERVER }));
    expect(r).toEqual({
      status: 500,
      body: { error, details: "chrome crashed", traceId: "trace-1" },
    });
  });

  it("answers 500 with the reason when Realtime is not configured", async () => {
    const r = await send(
      "POST",
      "/start-stream",
      { url: "u" },
      env({ CLOUDFLARE_REALTIME_APP_SECRET: undefined }),
    );
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_SECRET/);
    expect(calls).toEqual([]);
  });

  it("answers 500 when the SFU refuses the session", async () => {
    override = (c) => (c.url === `${SFU}/new` ? new Response("quota", { status: 429 }) : undefined);
    const r = await send("POST", "/start-stream", { url: "u" }, env({ STREAM_SERVER_URL: SERVER }));
    expect(r).toEqual({
      status: 500,
      body: { error: "Realtime API createSession failed: 429 — quota", traceId: "trace-1" },
    });
  });
});

describe("POST /stream/subscribe", () => {
  it("opens a subscriber session pulling the publisher's tracks and returns the SFU offer", async () => {
    const r = await send("POST", "/subscribe", { publisherSessionId: "pub-1" });
    expect(r).toEqual({
      status: 200,
      body: {
        subscriberSessionId: "sub-1",
        sessionDescription: { type: "offer", sdp: `tracks for ${SFU}/sub-1/tracks/new` },
        traceId: "trace-1",
      },
    });
    expect(calls[0].body).toBeUndefined();
    expect(calls[1].body).toEqual({
      tracks: [
        { location: "remote", trackName: "cast-video", sessionId: "pub-1" },
        { location: "remote", trackName: "cast-audio", sessionId: "pub-1" },
      ],
    });
  });

  it("pulls only the named tracks", async () => {
    await send("POST", "/subscribe", { publisherSessionId: "pub-1", trackNames: ["cast-video"] });
    expect(calls[1].body).toEqual({
      tracks: [{ location: "remote", trackName: "cast-video", sessionId: "pub-1" }],
    });
  });

  it.each([
    {},
    { publisherSessionId: 7 },
    { publisherSessionId: "" },
  ])("needs a publisherSessionId (%o)", async (body) => {
    const r = await send("POST", "/subscribe", body);
    expect(r).toEqual({
      status: 400,
      body: { error: "publisherSessionId is required", traceId: "trace-1" },
    });
  });

  it("answers 500 when the SFU fails", async () => {
    override = (c) =>
      c.url.endsWith("/tracks/new")
        ? json({ errorCode: "x", errorDescription: "gone" })
        : undefined;
    const r = await send("POST", "/subscribe", { publisherSessionId: "pub-1" });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/addTracks failed: 200 — x: gone/);
  });
});

describe("PUT /stream/subscribe/:id/answer", () => {
  it("renegotiates the subscriber session with the receiver's answer", async () => {
    const answer = { type: "answer", sdp: "receiver" };
    const r = await send("PUT", "/subscribe/sub-1/answer", { sessionDescription: answer });
    expect(r).toEqual({
      status: 200,
      body: {
        status: "success",
        sessionDescription: { type: "answer", sdp: "renegotiated" },
        traceId: "trace-1",
      },
    });
    expect(calls).toEqual([
      { url: `${SFU}/sub-1/renegotiate`, method: "PUT", body: { sessionDescription: answer } },
    ]);
  });

  it("answers 500 for a malformed answer", async () => {
    const r = await send("PUT", "/subscribe/sub-1/answer", {
      sessionDescription: { type: "nope" },
    });
    expect(r.status).toBe(500);
    expect(calls).toEqual([]);
  });
});

describe("GET /stream/ice-servers", () => {
  it("returns the TURN servers without port-53 urls, and the session id", async () => {
    const r = await send("GET", "/ice-servers", undefined, env(), {
      "x-stream-session-id": "cast-1",
    });
    expect(r).toEqual({
      status: 200,
      body: {
        iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
        traceId: "trace-1",
        sessionId: "cast-1",
      },
    });
    expect(calls[0]).toMatchObject({ method: "POST", body: { ttl: 300 } });
  });

  it.each([
    ["TURN is not configured", env({ CLOUDFLARE_TURN_API_TOKEN: undefined })],
    ["TURN refuses", env()],
  ])("falls back to Cloudflare STUN when %s", async (label, e) => {
    if (label === "TURN refuses") override = (c) => (c.url === TURN ? json({}, 401) : undefined);
    const r = await send("GET", "/ice-servers", undefined, e, { "x-stream-session-id": "bad id!" });
    expect(r.body).toEqual({
      iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
      traceId: "trace-1",
      sessionId: null,
    });
  });
});

describe("GET /stream/debug-state with DEBUG_STATE_TOKEN", () => {
  const debugState = async (headers: Record<string, string>) => {
    const e = env({ DEBUG_STATE_TOKEN: "s3cret" });
    return (await app.request("/api/v1/stream/debug-state", { headers }, e)).status;
  };

  it("forwards with the right token", async () => {
    expect(await debugState({ "x-debug-token": "s3cret" })).toBe(200);
    expect(doCalls.map((c) => c.url)).toEqual(["default-singleton-debug-v3/debug-state"]);
  });

  it.each([
    ["no token", {}],
    ["a wrong token of the same length", { "x-debug-token": "s3creT" }],
    ["a token of another length", { "x-debug-token": "s3cret!" }],
  ])("refuses %s", async (_label, headers) => {
    expect(await debugState(headers)).toBe(403);
    expect(doCalls).toEqual([]);
  });
});
