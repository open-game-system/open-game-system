import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { createServer } from "node:net";

/** A free local port. */
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const address = srv.address();
      srv.close(() => (address && typeof address === "object" ? resolve(address.port) : reject(new Error("no port"))));
    });
  });

let dev: ChildProcess | null = null;

/** Without GAME_ORIGIN: `wrangler dev` on a free port with its own Durable Object storage. */
export async function setup({ provide }: { provide: (key: "origin", value: string) => void }) {
  const given = process.env.GAME_ORIGIN;
  if (given) {
    provide("origin", given.replace(/\/$/, ""));
    return;
  }
  const port = await freePort();
  mkdirSync(".wrangler/seam", { recursive: true });
  const logFile = openSync(".wrangler/seam/dev.log", "w");
  dev = spawn("pnpm", ["exec", "wrangler", "dev", "--port", String(port), "--persist-to", ".wrangler/seam"], {
    stdio: ["ignore", logFile, logFile],
    detached: true,
  });
  const origin = `http://localhost:${port}`;
  for (let i = 0; i < 120; i++) {
    const res = await fetch(`${origin}/healthz`).catch(() => null);
    if (res?.ok) {
      provide("origin", origin);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("wrangler dev did not start in 60 s: see .wrangler/seam/dev.log");
}

export function teardown() {
  if (dev?.pid) process.kill(-dev.pid, "SIGTERM");
}

declare module "vitest" {
  export interface ProvidedContext {
    origin: string;
  }
}
