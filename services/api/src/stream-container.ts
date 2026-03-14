import type { Env } from "./types";

const OPEN_CONTAINER_PORT = 8080;

function logTrace(traceId: string, event: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[trace:${traceId}] ${event}`, details);
    return;
  }
  console.log(`[trace:${traceId}] ${event}`);
}

function withTraceHeader(response: Response, traceId: string): Response {
  const cloned = new Response(response.body, response);
  cloned.headers.set("x-stream-trace-id", traceId);
  return cloned;
}

// Helper functions
async function startAndWaitForPort(
  container: Container,
  portToAwait: number,
  traceId: string,
  maxTries = 120
) {
  const port = container.getTcpPort(portToAwait);

  for (let i = 0; i < maxTries; i++) {
    try {
      if (!container.running) {
        // @ts-ignore - enableInternet is required for Puppeteer to reach external websites
        container.start({ enableInternet: true });
        container.monitor();
        logTrace(traceId, "container_start_requested", { try: i + 1, port: portToAwait });
      }

      const res = await port.fetch("http://localhost:8080/ping", {
        // @ts-ignore
        signal: AbortSignal.timeout(1500),
        headers: {
          "x-stream-trace-id": traceId,
        },
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`fetch failed: ${res.status} ${text}`);
      }
      logTrace(traceId, "container_ready", { try: i + 1, port: portToAwait });
      return;
    } catch (err: unknown) {
      const error = err as Error;
      logTrace(traceId, "container_wait_retry", {
        try: i + 1,
        message: error.message,
        name: error.name,
      });
      const errMsg = (error.message || "").toLowerCase();
      if (
        errMsg.includes("listening") ||
        errMsg.includes("there is no container instance that can be provided") ||
        errMsg.includes("timeout") ||
        error.name === "TimeoutError" ||
        errMsg.includes("fetch failed")
      ) {
        await new Promise((res) => setTimeout(res, 500));
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `could not check container healthiness after ${maxTries} tries`
  );
}

async function waitForLocalhost(port: number, maxTries = 10) {
  for (let i = 0; i < maxTries; i++) {
    try {
      await fetch(`http://localhost:${port}/ping`);
      return;
    } catch (err: unknown) {
      console.error("Error connecting to localhost on", i, "try", err);
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  throw new Error(
    `could not connect to localhost:${port} after ${maxTries} tries`
  );
}

async function proxyFetch(
  container: Container,
  request: Request,
  portNumber: number,
  traceId: string
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set("x-stream-trace-id", traceId);
  const response = await container
    .getTcpPort(portNumber)
    .fetch(request.url.replace("https://", "http://"), {
      method: request.method,
      headers,
      body: request.body,
    });
  return response;
}

function createJsonResponse(data: unknown, init?: ResponseInit): Response {
  const jsonString = JSON.stringify(data);
  return new Response(jsonString, {
    ...init,
    headers: {
      ...init?.headers,
      "Content-Type": "application/json",
    },
  }) as unknown as Response;
}

// Durable Object implementation
export class StreamContainer implements DurableObject {
  private waitPromise: Promise<void> | null = null;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env
  ) {}

  private async ensureRunning(traceId: string) {
    if (this.ctx.container && !this.ctx.container.running && this.waitPromise) {
      logTrace(traceId, "do_container_stopped_resetting_wait_promise");
      this.waitPromise = null;
    }

    if (this.waitPromise) return this.waitPromise;

    this.waitPromise = (async () => {
      if (!this.ctx.container) {
        logTrace(traceId, "do_localhost_mode");
        await waitForLocalhost(OPEN_CONTAINER_PORT);
      } else {
        logTrace(traceId, "do_container_mode");
        await startAndWaitForPort(this.ctx.container, OPEN_CONTAINER_PORT, traceId);
      }
    })();

    return this.waitPromise;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const traceId = request.headers.get("x-stream-trace-id") || crypto.randomUUID();
    const startedAt = Date.now();
    logTrace(traceId, "do_request_received", {
      method: request.method,
      path: url.pathname,
    });

    try {
      await this.ensureRunning(traceId);

      if (!this.ctx.container) {
        // No container, proxy to localhost:8080
        logTrace(traceId, "do_proxy_local", { method: request.method, path: url.pathname });
        const localUrl = request.url.replace(new URL(request.url).origin, 'http://localhost:8080');
        const response = await fetch(localUrl, {
          method: request.method,
          headers: new Headers(request.headers),
          body: request.body,
        });
        const tracedResponse = withTraceHeader(response, traceId);
        logTrace(traceId, "do_response_sent", {
          status: tracedResponse.status,
          durationMs: Date.now() - startedAt,
        });
        return tracedResponse;
      } else {
        // Use the container
        logTrace(traceId, "do_proxy_container", { method: request.method, path: url.pathname });
        const res = await proxyFetch(
          this.ctx.container,
          request,
          OPEN_CONTAINER_PORT,
          traceId
        );
        const tracedResponse = withTraceHeader(res, traceId);
        logTrace(traceId, "do_response_sent", {
          status: tracedResponse.status,
          durationMs: Date.now() - startedAt,
        });
        return tracedResponse;
      }
    } catch (error) {
      if (
        this.ctx.container &&
        (error as Error).message.includes("container is not running")
      ) {
        logTrace(traceId, "do_retry_after_container_stopped");
        this.waitPromise = null;
        await this.ensureRunning(traceId);

        const retriedResponse = await proxyFetch(
          this.ctx.container,
          request,
          OPEN_CONTAINER_PORT,
          traceId
        );
        const tracedResponse = withTraceHeader(retriedResponse, traceId);
        logTrace(traceId, "do_response_sent_after_retry", {
          status: tracedResponse.status,
          durationMs: Date.now() - startedAt,
        });
        return tracedResponse;
      }

      logTrace(traceId, "do_error", {
        message: (error as Error).message,
        durationMs: Date.now() - startedAt,
      });
      return createJsonResponse(
        {
          error: (!this.ctx.container ? "Local server" : "Container") + " error: " + (error as Error).message,
          traceId,
        },
        {
          status: 500,
          headers: {
            "x-stream-trace-id": traceId,
          },
        }
      );
    }
  }
}
