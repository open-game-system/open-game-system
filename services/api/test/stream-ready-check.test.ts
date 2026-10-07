import { describe, expect, it } from "vitest";
import { checkStreamReady, type ReadyDeps } from "../scripts/stream-ready-check.mjs";

/**
 * The post-deploy stream check (`pnpm stream:ready <apiBase>`): never starts a render. It asks the
 * API's stream route for ICE servers (TURN credentials, no render), the API's /stream/ready
 * booleans, and Cloud Run's control plane for the renderer's state (no instance starts). The
 * renderer's own /health is opt-in: on a scaled-to-zero GPU service it cold-starts an L4.
 */
const API = "https://api.example";

function deps(over: Partial<ReadyDeps> = {}): ReadyDeps & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    fetchJson: async (url) => {
      seen.push(url);
      if (url === `${API}/api/v1/stream/ice-servers`)
        return {
          status: 200,
          json: {
            iceServers: [{ urls: ["turn:turn.example:3478"], username: "u", credential: "c" }],
          },
        };
      if (url === `${API}/api/v1/stream/ready`)
        return {
          status: 200,
          json: {
            ready: true,
            renderer: { url: true },
            realtime: true,
            turn: true,
          },
        };
      if (url === "https://gpu.example/health") return { status: 200, json: { status: "healthy" } };
      return { status: 404, json: null };
    },
    describeRenderer: async () => ({ ready: true, url: "https://gpu.example", minInstances: 0 }),
    ...over,
  };
}

describe("checkStreamReady", () => {
  it("passes when the route answers with TURN, the API is configured and Cloud Run says Ready", async () => {
    const d = deps();
    const r = await checkStreamReady(`${API}/`, d);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => [c.name, c.result])).toEqual([
      ["stream route", "ok"],
      ["api config", "ok"],
      ["renderer service", "ok"],
      ["renderer health", "skip"],
    ]);
    expect(r.checks[1]).toMatchObject({
      result: "ok",
      detail: "renderer (STREAM_SERVER_URL), Realtime, TURN",
    });
    expect(r.checks[3].detail).toMatch(/cold-start/);
    // Never a render: no start-stream, subscribe, or renderer call.
    expect(d.seen).toEqual([`${API}/api/v1/stream/ice-servers`, `${API}/api/v1/stream/ready`]);
  });

  it("never prints a credential", async () => {
    const r = await checkStreamReady(API, deps());
    const text = JSON.stringify(r);
    expect(text).not.toContain('"u"');
    expect(text).not.toContain("credential");
    expect(text).not.toContain("turn.example");
  });

  it("fails the route when only STUN comes back (TURN not configured or refused)", async () => {
    const base = deps();
    const r = await checkStreamReady(API, {
      ...base,
      fetchJson: async (url) =>
        url.endsWith("/ice-servers")
          ? { status: 200, json: { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }] } }
          : base.fetchJson(url),
    });
    expect(r.ok).toBe(false);
    expect(r.checks[0]).toMatchObject({ result: "fail", detail: expect.stringMatching(/no TURN/) });
  });

  it("says the readiness route needs a deploy when the API doesn't have it (404)", async () => {
    const base = deps();
    const r = await checkStreamReady(API, {
      ...base,
      fetchJson: async (url) =>
        url.endsWith("/ready") ? { status: 404, json: null } : base.fetchJson(url),
    });
    expect(r.ok).toBe(false);
    expect(r.checks[1]).toMatchObject({
      result: "fail",
      detail: expect.stringMatching(/not deployed/),
    });
  });

  it("names what the API is missing", async () => {
    const base = deps();
    const r = await checkStreamReady(API, {
      ...base,
      fetchJson: async (url) =>
        url.endsWith("/ready")
          ? {
              status: 503,
              json: {
                ready: false,
                renderer: { url: false },
                realtime: true,
                turn: false,
              },
            }
          : base.fetchJson(url),
    });
    expect(r.checks[1]).toMatchObject({
      result: "fail",
      detail: "missing: renderer (STREAM_SERVER_URL), TURN",
    });
  });

  it("fails when Cloud Run says the renderer isn't Ready, skips when it can't ask", async () => {
    const notReady = await checkStreamReady(
      API,
      deps({ describeRenderer: async () => ({ ready: false, url: null, minInstances: 0 }) }),
    );
    expect(notReady.checks[2].result).toBe("fail");
    const cannot = await checkStreamReady(API, deps({ describeRenderer: async () => null }));
    expect(cannot.checks[2].result).toBe("skip");
    expect(cannot.ok).toBe(true);
  });

  it("probes the renderer's /health only when asked", async () => {
    const d = deps();
    const r = await checkStreamReady(API, d, { probeRenderer: true });
    expect(r.checks[3]).toMatchObject({ name: "renderer health", result: "ok" });
    expect(d.seen).toContain("https://gpu.example/health");
  });

  it("reports an unreachable API as a failure, not a crash", async () => {
    const r = await checkStreamReady(
      API,
      deps({
        fetchJson: async () => {
          throw new Error("timeout");
        },
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.checks[0]).toMatchObject({ result: "fail", detail: "timeout" });
  });
});
