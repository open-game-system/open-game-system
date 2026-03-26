import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

type TestEnv = Parameters<typeof worker.fetch>[1];

function createContainerNamespace(fetchImpl?: (request: Request) => Promise<Response>) {
  const calls: Request[] = [];
  const stubFetch = vi.fn(async (request: Request) => {
    calls.push(request);
    if (fetchImpl) {
      return fetchImpl(request);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  return {
    idFromName: vi.fn(() => "stream-id"),
    get: vi.fn(() => ({ fetch: stubFetch })),
    stubFetch,
    calls,
  };
}

function createEnv(overrides: Partial<TestEnv> = {}) {
  const container = createContainerNamespace();
  const env: TestEnv = {
    CLOUDFLARE_TURN_API_TOKEN: "turn-token",
    CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
    STREAM_CONTAINER: container as unknown as TestEnv["STREAM_CONTAINER"],
    ...overrides,
  };

  return { env, container };
}

describe("bun-stream-server worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns normalized TURN ice servers", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            iceServers: [
              {
                urls: [
                  "stun:stun.cloudflare.com:3478",
                  "turn:turn.cloudflare.com:53?transport=udp",
                ],
              },
              {
                urls: "turn:turn.cloudflare.com:5349?transport=tcp",
                username: "user",
                credential: "pass",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { env } = createEnv();
    const response = await worker.fetch(
      new Request("https://example.com/ice-servers", {
        headers: {
          "x-stream-trace-id": "trace-ice-1",
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      iceServers: [
        {
          urls: ["stun:stun.cloudflare.com:3478"],
        },
        {
          urls: ["turn:turn.cloudflare.com:5349?transport=tcp"],
          username: "user",
          credential: "pass",
        },
      ],
      sessionId: null,
      traceId: "trace-ice-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/turn/keys/turn-key-id/credentials/generate-ice-servers",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer turn-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 300 }),
      },
    );
  });

  it("blocks /debug-state when the debug token is missing", async () => {
    const { env, container } = createEnv({ DEBUG_STATE_TOKEN: "top-secret" });

    const response = await worker.fetch(
      new Request("https://example.com/debug-state", {
        headers: {
          "x-stream-trace-id": "trace-debug-blocked",
        },
      }),
      env,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden",
      traceId: "trace-debug-blocked",
    });
    expect(container.get).not.toHaveBeenCalled();
    expect(container.stubFetch).not.toHaveBeenCalled();
  });

  it("forwards /debug-state when the debug token matches", async () => {
    const { env, container } = createEnv({ DEBUG_STATE_TOKEN: "top-secret" });

    const response = await worker.fetch(
      new Request("https://example.com/debug-state", {
        headers: {
          "x-stream-trace-id": "trace-debug-allowed",
          "x-debug-token": "top-secret",
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(container.get).toHaveBeenCalledOnce();
    expect(container.stubFetch).toHaveBeenCalledOnce();

    const forwardedRequest = container.calls[0];
    expect(forwardedRequest.headers.get("x-stream-trace-id")).toBe("trace-debug-allowed");
  });

  it("routes requests to a session-scoped durable object when a session header is present", async () => {
    const { env, container } = createEnv();

    const response = await worker.fetch(
      new Request("https://example.com/start-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-stream-trace-id": "trace-session-1",
          "x-stream-session-id": "receiver-session-1",
        },
        body: JSON.stringify({
          url: "https://example.com",
          peerId: "receiver-123",
          iceServers: [],
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(container.idFromName).toHaveBeenCalledWith("session-receiver-session-1");

    const forwardedRequest = container.calls[0];
    expect(forwardedRequest.headers.get("x-stream-session-id")).toBe("receiver-session-1");
  });
});
