import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";

/**
 * GET /api/v1/stream/ready: what a post-deploy check (scripts/stream-ready.mjs) needs to know
 * without starting a render: is a renderer configured (Cloud Run URL or the container binding),
 * Realtime (SFU) and TURN. Booleans only — never a URL, id or secret — and no call goes out.
 */
const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

const containerFetch = vi.fn();
const FULL = {
  STREAM_SERVER_URL: "https://stream-gpu.example.run.app",
  STREAM_CONTAINER: { idFromName: vi.fn(), get: vi.fn(() => ({ fetch: containerFetch })) },
  CLOUDFLARE_REALTIME_APP_ID: "app-id-value",
  CLOUDFLARE_REALTIME_APP_SECRET: "app-secret-value",
  CLOUDFLARE_TURN_API_TOKEN: "turn-token-value",
  CLOUDFLARE_TURN_KEY_ID: "turn-key-value",
};

async function ready(env: Record<string, unknown>) {
  const res = await app.request("/api/v1/stream/ready", {}, env);
  return { status: res.status, text: await res.text() };
}

describe("GET /api/v1/stream/ready", () => {
  it("reports everything configured, as booleans only", async () => {
    const r = await ready(FULL);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({
      ready: true,
      renderer: { url: true, container: true },
      realtime: true,
      turn: true,
    });
    for (const value of Object.values(FULL))
      if (typeof value === "string") expect(r.text).not.toContain(value);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(containerFetch).not.toHaveBeenCalled();
  });

  it("is ready with the container renderer when no STREAM_SERVER_URL is set", async () => {
    const r = JSON.parse((await ready({ ...FULL, STREAM_SERVER_URL: undefined })).text);
    expect(r).toEqual({
      ready: true,
      renderer: { url: false, container: true },
      realtime: true,
      turn: true,
    });
  });

  it.each([
    [
      "no renderer",
      { STREAM_SERVER_URL: "", STREAM_CONTAINER: undefined },
      { renderer: { url: false, container: false } },
    ],
    [
      "Realtime without its secret",
      { CLOUDFLARE_REALTIME_APP_SECRET: undefined },
      { realtime: false },
    ],
    ["Realtime without its app id", { CLOUDFLARE_REALTIME_APP_ID: "" }, { realtime: false }],
    ["TURN without its key id", { CLOUDFLARE_TURN_KEY_ID: undefined }, { turn: false }],
    ["TURN without its token", { CLOUDFLARE_TURN_API_TOKEN: "" }, { turn: false }],
  ])("answers 503, not ready, with %s", async (_label, missing, expected) => {
    const r = await ready({ ...FULL, ...missing });
    expect(r.status).toBe(503);
    expect(JSON.parse(r.text)).toMatchObject({ ready: false, ...expected });
  });
});
