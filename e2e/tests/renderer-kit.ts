// The real renderer (services/api/container/src/server.ts) on this machine: local Chrome via
// Puppeteer with the capture extension, no GPU, no Cloud Run. Plus a local view page for it to
// render, and the stream server routes the receiver calls, wired to it (see stream-pipe.e2e.ts).
// Everything here is stopped in `stop()`; `leftovers()` proves nothing is still running.
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import streamRoutes from "../../services/api/src/routes/stream";
import type { Json, Reply, StreamCall } from "./receiver-kit";

const CONTAINER = fileURLToPath(new URL("../../services/api/container/", import.meta.url));
const EXTENSION = `${CONTAINER}extension`;
const TSX = `${CONTAINER}node_modules/.bin/tsx`;
/** Hard limit for anything this kit starts: past it, the watchdog kills it whatever the test does. */
export const HARD_LIMIT_MS = 120_000;

/** Listens on a free loopback port; returns it. */
async function listen(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no TCP address");
  return address.port;
}

/** A free TCP port on loopback. */
async function freePort(): Promise<number> {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

function toJson(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = toJson(v);
    return out;
  }
  return null;
}

async function replyOf(res: Response): Promise<Reply> {
  const text = await res.text();
  let json: Json;
  try {
    json = toJson(JSON.parse(text));
  } catch {
    json = { text };
  }
  return { status: res.status, json };
}

/** PIDs of processes from this checkout's renderer: its Chrome (loads this extension) and its server. */
export function leftovers(): string[] {
  const ps = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  return ps
    .split("\n")
    .filter((line) => line.includes(EXTENSION) || line.includes(`${CONTAINER}src/server.ts`))
    .filter((line) => !line.includes(" ps -axo"))
    .map((line) => line.trim());
}

function killLeftovers() {
  for (const line of leftovers()) {
    const pid = Number(line.split(/\s+/)[0]);
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

export interface Renderer {
  url: string;
  /** Renderer stdout/stderr lines (its trace log), minus the extension-detection noise. */
  log: string[];
  health: () => Promise<{ browserActive: boolean }>;
  /** SIGTERM (its own graceful shutdown closes Chrome), then SIGKILL anything of it still running. */
  stop: () => Promise<void>;
}

const Health = z.object({ browserActive: z.boolean() });

/** Starts the renderer on a free port; `env` adds to its environment (e.g. STREAM_IDLE_MS). */
export async function startRenderer(env: Record<string, string> = {}): Promise<Renderer> {
  if (!existsSync(TSX))
    throw new Error(
      "services/api/container has no node_modules: see docs/testing/e2e.md (stream full pipe)",
    );
  if (leftovers().length > 0)
    throw new Error(`a renderer from this checkout is already running:\n${leftovers().join("\n")}`);
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const log: string[] = [];
  const child: ChildProcess = spawn(TSX, ["src/server.ts"], {
    cwd: CONTAINER,
    env: { ...process.env, PORT: String(port), ...env },
    detached: true, // its own process group: stop() kills tsx and node together
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const collect = (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n"))
      if (line.trim() && !line.includes("🔍")) log.push(line);
    if (log.length > 2000) log.splice(0, log.length - 2000);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(watchdog);
    if (child.exitCode === null && child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // already gone
      }
      await Promise.race([exited, new Promise((r) => setTimeout(r, 8000))]);
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // exited
      }
    }
    // Puppeteer starts Chrome in a process group of its own: sweep it by its extension path.
    killLeftovers();
  }
  const watchdog = setTimeout(() => {
    log.push(`[renderer-kit] hard limit ${HARD_LIMIT_MS} ms reached: killing the renderer`);
    void stop();
  }, HARD_LIMIT_MS);
  watchdog.unref();

  const health = async () => Health.parse(await (await fetch(`${url}/health`)).json());
  const deadline = Date.now() + 20_000;
  for (;;) {
    const up = await health().catch(() => null);
    if (up) break;
    if (child.exitCode !== null || Date.now() > deadline) {
      await stop();
      throw new Error(`the renderer did not start:\n${log.slice(-30).join("\n")}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { url, log, health, stop };
}

/**
 * The view page the renderer streams: a full-screen canvas whose colour cycles and a white square
 * that moves (so consecutive frames differ), keeping `window.__ogsActivityAt` fresh while a player
 * is "active". `setActive(false)` makes it stop reporting activity (it keeps animating).
 */
export interface ViewServer {
  url: string;
  setActive: (active: boolean) => void;
  close: () => Promise<void>;
}

const VIEW_PAGE = `<!doctype html><html><head><title>OGS pipe view</title></head>
<body style="margin:0;background:#000;overflow:hidden">
<canvas id="c" width="1280" height="720" style="width:100vw;height:100vh;display:block"></canvas>
<script>
  const ctx = document.getElementById('c').getContext('2d');
  let active = true;
  setInterval(() => fetch('/control').then((r) => r.json()).then((c) => { active = c.active; }).catch(() => {}), 200);
  function frame(t) {
    const hue = (t / 20) % 360;
    ctx.fillStyle = 'hsl(' + hue + ' 80% 45%)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#fff';
    ctx.fillRect(((t / 4) % 1180), 300, 100, 100);
    if (active) window.__ogsActivityAt = Date.now();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
</script></body></html>`;

export async function startViewServer(): Promise<ViewServer> {
  let active = true;
  const server = http.createServer((req, res) => {
    if (req.url === "/control") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ active }));
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(VIEW_PAGE);
  });
  const port = await listen(server);
  return {
    url: `http://127.0.0.1:${port}/view`,
    setActive: (value) => {
      active = value;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** The API's own stream routes (services/api/src/routes/stream.ts), in this process, with `env`. */
async function apiRoute(call: StreamCall, env: Record<string, string>): Promise<Reply> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (call.session) headers["x-stream-session-id"] = call.session;
  const res = await streamRoutes.request(
    call.path,
    {
      method: call.method,
      headers,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
    },
    env,
  );
  return replyOf(res);
}

const StartBody = z.object({ url: z.string() });
const Offer = z.object({ type: z.literal("offer"), sdp: z.string() });
const Prepared = z.object({ sessionDescription: Offer });
const AnswerBody = z.object({
  sessionDescription: z.object({ type: z.literal("answer"), sdp: z.string() }),
});

/**
 * The stream server, local: the SFU is a loopback stand-in (the renderer's offer goes to the
 * receiver as the subscribe offer, the receiver's answer back to the renderer), so the picture
 * flows renderer → receiver directly. The heartbeat runs the API's real route against the renderer.
 */
export function loopbackStreamServer(renderer: Renderer) {
  let offer: z.infer<typeof Offer> | null = null;
  const post = (path: string, body: unknown) =>
    fetch(`${renderer.url}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return async (call: StreamCall): Promise<Reply | null> => {
    if (call.path === "/ice-servers")
      return { status: 200, json: { iceServers: [], traceId: "loopback", sessionId: null } };
    if (call.path === "/start-stream") {
      const res = await post("/publisher/prepare", {
        url: StartBody.parse(call.body).url,
        iceServers: [],
      });
      if (!res.ok) {
        const message = await res.text();
        return {
          status: 500,
          json: { error: { code: "publisher_prepare_failed", message, status: 500 } },
        };
      }
      offer = Prepared.parse(await res.json()).sessionDescription;
      return {
        status: 200,
        json: { status: "success", publisherSessionId: "loopback-pub", traceId: "loopback" },
      };
    }
    if (call.path === "/subscribe" && offer)
      return {
        status: 200,
        json: {
          subscriberSessionId: "loopback-sub",
          sessionDescription: offer,
          traceId: "loopback",
        },
      };
    if (call.path === "/subscribe/loopback-sub/answer") {
      const res = await post("/publisher/answer", AnswerBody.parse(call.body));
      return replyOf(res);
    }
    if (call.path === "/heartbeat") return apiRoute(call, { STREAM_SERVER_URL: renderer.url });
    return null;
  };
}

/** Names of the variables the Cloudflare Realtime + TURN leg needs. */
export const SFU_ENV = [
  "CLOUDFLARE_REALTIME_APP_ID",
  "CLOUDFLARE_REALTIME_APP_SECRET",
  "CLOUDFLARE_TURN_API_TOKEN",
  "CLOUDFLARE_TURN_KEY_ID",
] as const;

export const missingSfuEnv = () => SFU_ENV.filter((name) => !process.env[name]);

/**
 * The stream server through Cloudflare Realtime: every call runs the API's own route with the
 * renderer as STREAM_SERVER_URL and the Realtime/TURN credentials from this environment (never
 * logged). Billable: only under OGS_E2E_SFU=1.
 */
export function sfuStreamServer(renderer: Renderer) {
  const env: Record<string, string> = { STREAM_SERVER_URL: renderer.url };
  for (const name of SFU_ENV) env[name] = process.env[name] ?? "";
  return (call: StreamCall): Promise<Reply> => apiRoute(call, env);
}
