// Shared by shoot.ts and flows.ts: build a private snapshot of the prototype and serve it,
// so agents editing in parallel can't change the app mid-shoot.
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { Page } from "playwright";

export const ROOT = resolve(import.meta.dirname, "..");

export interface ScenarioMeta {
  id: string;
  label: string;
  flow: string;
  state: string;
  devices: ("phone" | "ipad" | "tv")[];
}
export interface FlowMeta {
  id: string;
  flow: string;
  label: string;
  start: string;
  steps: { device: "phone" | "ipad" | "tv"; bot: string; mark?: string; wait?: number }[];
}
export interface ConceptMeta {
  id: string;
  name: string;
  brief: string;
  scenarios: ScenarioMeta[];
  flows: FlowMeta[];
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".mp4": "video/mp4",
};

export async function buildAndServe(tag: string, only?: string[]): Promise<{ base: string; server: Server }> {
  const out = join(ROOT, ".cache", `dist-${tag}`);
  const env = { ...process.env, OGS_CONCEPTS: only?.join(",") ?? "" };
  execFileSync("pnpm", ["exec", "vite", "build", "--outDir", out, "--emptyOutDir", "--logLevel", "error"], { cwd: ROOT, stdio: "inherit", env });
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    let file = join(out, path);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    } catch {
      file = join(out, "index.html");
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { base: `http://127.0.0.1:${port}/`, server };
}

export async function readRegistry(page: Page, base: string): Promise<ConceptMeta[]> {
  await page.goto(base);
  await page.waitForFunction(() => Array.isArray(window.__ogsRegistry));
  const raw: unknown = await page.evaluate(() => window.__ogsRegistry);
  if (!Array.isArray(raw)) throw new Error("registry missing");
  return raw.filter(isConcept);
}

function isConcept(x: unknown): x is ConceptMeta {
  return typeof x === "object" && x !== null && "id" in x && "scenarios" in x && "flows" in x;
}

/** Waits for the scenario switcher's acknowledgement and fails loudly on a mismatch. */
export async function waitForAck(page: Page, expected: string): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.scenarioAck || document.documentElement.dataset.scenarioError, null, { timeout: 15000 });
  const { ack, error } = await page.evaluate(() => ({ ack: document.documentElement.dataset.scenarioAck, error: document.documentElement.dataset.scenarioError }));
  if (error) throw new Error(`scenario error: ${error}`);
  if (ack !== expected) throw new Error(`scenario ack mismatch: wanted ${expected}, page says ${ack}`);
}

export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(400);
  await page.evaluate(async () => {
    // @import'd font CSS can arrive after fonts.ready first resolves: wait for every face that's loading.
    await document.fonts.ready;
    await Promise.all([...document.fonts].filter((f) => f.status === "loading").map((f) => f.loaded.catch(() => undefined)));
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? Promise.resolve() : i.decode().catch(() => undefined))));
  });
  await page.waitForTimeout(250);
}

declare global {
  interface Window {
    __ogsRegistry?: unknown;
    __ogsMark?: (text: string) => void;
  }
}
