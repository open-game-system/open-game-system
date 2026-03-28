import { readFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { type APIRequestContext, expect, type TestInfo, test } from "@playwright/test";

const previewUrl = process.env.E2E_STREAM_SERVER_URL;

function buildTraceId() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function attachDebugState(
  request: APIRequestContext,
  testInfo: TestInfo,
  traceId: string | null,
) {
  if (!previewUrl || !traceId) {
    return;
  }

  const response = await request.get(`${previewUrl}/debug-state`, {
    headers: {
      "x-stream-trace-id": traceId,
      ...(process.env.DEBUG_STATE_TOKEN ? { "x-debug-token": process.env.DEBUG_STATE_TOKEN } : {}),
    },
  });

  await testInfo.attach("debug-state", {
    body: Buffer.from(await response.text(), "utf8"),
    contentType: "application/json",
  });
}

function createReceiverProxyServer() {
  let server: http.Server | null = null;
  let baseUrl: string | null = null;
  const upstreamLog: Array<{
    path: string;
    method: string;
    status: number;
    body: string;
  }> = [];
  const disallowedForwardHeaders = new Set([
    "accept-encoding",
    "content-length",
    "connection",
    "host",
    "transfer-encoding",
  ]);

  return {
    async start() {
      if (server || !previewUrl) {
        return baseUrl;
      }

      const receiverPath = path.resolve(process.cwd(), "receiver.html");

      server = http.createServer(async (req, res) => {
        const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");

        if (requestUrl.pathname === "/" || requestUrl.pathname === "/receiver.html") {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(await readFile(receiverPath));
          return;
        }

        if (requestUrl.pathname.startsWith("/proxy/")) {
          const upstreamPath = requestUrl.pathname.replace(/^\/proxy/, "") + requestUrl.search;
          const upstreamUrl = `${previewUrl}${upstreamPath}`;
          const bodyChunks: Buffer[] = [];

          for await (const chunk of req) {
            bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }

          const upstreamResponse = await fetch(upstreamUrl, {
            method: req.method,
            headers: Object.fromEntries(
              Object.entries(req.headers)
                .filter(
                  ([key, value]) =>
                    value !== undefined && !disallowedForwardHeaders.has(key.toLowerCase()),
                )
                .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]),
            ),
            body:
              req.method === "GET" || req.method === "HEAD" || bodyChunks.length === 0
                ? undefined
                : Buffer.concat(bodyChunks),
          });
          const upstreamBody = Buffer.from(await upstreamResponse.arrayBuffer());
          upstreamLog.push({
            path: upstreamPath,
            method: req.method ?? "GET",
            status: upstreamResponse.status,
            body: upstreamBody.toString("utf8"),
          });

          const responseHeaders: Record<string, string> = {
            "Content-Type":
              upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
          };
          const responseTraceId = upstreamResponse.headers.get("x-stream-trace-id");
          if (responseTraceId) {
            responseHeaders["x-stream-trace-id"] = responseTraceId;
          }

          res.writeHead(upstreamResponse.status, responseHeaders);
          res.end(upstreamBody);
          return;
        }

        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
      });

      await new Promise<void>((resolve, reject) => {
        server?.once("error", reject);
        server?.listen(0, "127.0.0.1", () => resolve());
      });

      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      return baseUrl;
    },

    async stop() {
      if (!server) {
        return;
      }

      const activeServer = server;
      server = null;
      baseUrl = null;

      await new Promise<void>((resolve, reject) => {
        activeServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },

    getUpstreamLog() {
      return [...upstreamLog];
    },
  };
}

test.describe("Cloudflare preview stream", () => {
  test.skip(!previewUrl, "E2E_STREAM_SERVER_URL is required for real-infra streaming tests");

  test("boots the deployed Worker stack and returns TURN-backed session config", async ({
    request,
  }, testInfo) => {
    const traceId = buildTraceId();
    const sessionId = `ci-session-${Math.random().toString(36).slice(2, 10)}`;
    let healthPayload: unknown = null;
    let icePayload: any = null;

    try {
      const healthResponse = await request.get(`${previewUrl}/health`);
      expect(healthResponse.ok()).toBeTruthy();

      healthPayload = await healthResponse.json();
      expect((healthPayload as { status?: string }).status).toBe("healthy");

      const iceResponse = await request.get(`${previewUrl}/ice-servers`, {
        headers: {
          "x-stream-trace-id": traceId,
          "x-stream-session-id": sessionId,
        },
      });
      expect(iceResponse.ok()).toBeTruthy();

      icePayload = await iceResponse.json();
      expect(Array.isArray(icePayload.iceServers)).toBeTruthy();
      expect(icePayload.iceServers.length).toBeGreaterThan(0);
      expect(icePayload.traceId).toBe(traceId);

      const turnUrlSet = new Set(
        icePayload.iceServers.flatMap((server: { urls: string | string[] }) =>
          Array.isArray(server.urls) ? server.urls : [server.urls],
        ),
      );
      expect([...turnUrlSet].some((url) => url.startsWith("stun:"))).toBeTruthy();
      expect([...turnUrlSet].some((url) => url.startsWith("turn:"))).toBeTruthy();

      const diagnostics = {
        traceId,
        sessionId,
        healthPayload,
        iceServerCount: icePayload.iceServers.length,
      };

      await testInfo.attach("preview-smoke", {
        body: Buffer.from(JSON.stringify(diagnostics, null, 2), "utf8"),
        contentType: "application/json",
      });
    } finally {
      await testInfo.attach("start-response", {
        body: Buffer.from(
          JSON.stringify(
            {
              traceId,
              sessionId,
              healthPayload,
              iceServerCount: icePayload?.iceServers?.length ?? null,
            },
            null,
            2,
          ),
          "utf8",
        ),
        contentType: "application/json",
      });

      await attachDebugState(request, testInfo, traceId);
    }
  });

  // TODO: Replace 0.peerjs.com with self-hosted PeerJS or Cloudflare Realtime SFU
  // PeerJS public signaling server is unreliable in CI. The container works
  // (Chrome launches, /start-stream returns success) but WebRTC signaling
  // through 0.peerjs.com intermittently fails. Local cast-e2e tests pass
  // 10/10 with a local PeerJS server. See: cast-stream.spec.ts
  test.fixme("receiver page plays the remote stream end to end", async ({ page, request }, testInfo) => {
    const targetUrl = process.env.E2E_TARGET_URL || "https://example.com";
    const receiverProxy = createReceiverProxyServer();
    const receiverBaseUrl = await receiverProxy.start();
    const receiverPageUrl = new URL(`${receiverBaseUrl}/receiver.html`);
    receiverPageUrl.searchParams.set("serverUrl", `${receiverBaseUrl}/proxy`);
    receiverPageUrl.searchParams.set("streamUrl", targetUrl);
    receiverPageUrl.searchParams.set("autostart", "1");

    const consoleLines: string[] = [];
    page.on("console", (message) => {
      consoleLines.push(`[${message.type()}] ${message.text()}`);
    });

    let traceId: string | null = null;

    try {
      await page.goto(receiverPageUrl.toString(), { waitUntil: "load" });

      await page.waitForFunction(
        () => {
          const statusEl = document.getElementById("status");
          return statusEl?.dataset.status === "connected";
        },
        undefined,
        { timeout: 180_000 },
      );

      await page.waitForFunction(
        () => {
          const video = document.getElementById("remoteVideo") as HTMLVideoElement | null;
          return Boolean(
            video &&
              video.videoWidth > 0 &&
              video.videoHeight > 0 &&
              video.readyState >= 2 &&
              video.currentTime > 0,
          );
        },
        undefined,
        { timeout: 60_000 },
      );

      const receiverState = await page.evaluate(() => {
        const statusEl = document.getElementById("status");
        const video = document.getElementById("remoteVideo") as HTMLVideoElement | null;

        return {
          status: statusEl?.dataset.status ?? null,
          message: statusEl?.dataset.message ?? null,
          traceId: statusEl?.dataset.traceId ?? null,
          currentTime: video?.currentTime ?? null,
          videoWidth: video?.videoWidth ?? null,
          videoHeight: video?.videoHeight ?? null,
          readyState: video?.readyState ?? null,
          paused: video?.paused ?? null,
        };
      });

      traceId = receiverState.traceId;

      expect(receiverState.status).toBe("connected");
      expect(receiverState.videoWidth).toBeGreaterThan(0);
      expect(receiverState.videoHeight).toBeGreaterThan(0);
      expect(receiverState.readyState).toBeGreaterThanOrEqual(2);
      expect(receiverState.currentTime).toBeGreaterThan(0);

      await testInfo.attach("receiver-state", {
        body: Buffer.from(JSON.stringify(receiverState, null, 2), "utf8"),
        contentType: "application/json",
      });
    } finally {
      try {
        const stateTraceId = await page
          .evaluate(() => document.getElementById("status")?.dataset.traceId ?? null)
          .catch(() => null);
        traceId = traceId ?? stateTraceId;

        await testInfo.attach("browser-console", {
          body: Buffer.from(consoleLines.join("\n"), "utf8"),
          contentType: "text/plain",
        });

        await testInfo.attach("proxy-upstream-log", {
          body: Buffer.from(JSON.stringify(receiverProxy.getUpstreamLog(), null, 2), "utf8"),
          contentType: "application/json",
        });

        await attachDebugState(request, testInfo, traceId);
      } finally {
        await receiverProxy.stop();
      }
    }
  });
});
