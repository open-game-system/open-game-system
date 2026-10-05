#!/usr/bin/env node
// Post-deploy stream readiness, without starting a render (no GPU, no SFU session):
//   pnpm stream:ready <apiBase> [--probe-renderer]
// 1. the API's stream route answers with TURN servers (GET /stream/ice-servers)
// 2. the API reports a renderer, Realtime and TURN configured (GET /stream/ready, booleans only)
// 3. Cloud Run's control plane says the renderer service is Ready (gcloud; starts no instance)
// 4. --probe-renderer only: the renderer's /health (cold-starts a scaled-to-zero GPU instance)
// Hard limit 20 s. Exit 0 when nothing failed. Prints results only, never secrets or URLs.
import { execFile } from "node:child_process";
import { checkStreamReady } from "./stream-ready-check.mts";

const LIMIT_MS = 20_000;
const RENDERER = { service: "stream-gpu", project: "opengame-stream", region: "us-east4" };

const args = process.argv.slice(2);
const apiBase = args.find((a) => !a.startsWith("--"));
if (!apiBase) {
  console.error("usage: pnpm stream:ready <apiBase> [--probe-renderer]");
  process.exit(2);
}
const deadline = AbortSignal.timeout(LIMIT_MS);
setTimeout(() => {
  console.error(`stream:ready: gave up after ${LIMIT_MS / 1000} s`);
  process.exit(1);
}, LIMIT_MS).unref();

async function fetchJson(url) {
  const res = await fetch(url, { signal: deadline });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json };
}

/** Cloud Run's description of the renderer (control plane: no instance starts), or null. */
function describeRenderer() {
  const { service, project, region } = RENDERER;
  return new Promise((resolve) => {
    execFile(
      "gcloud",
      [
        "run",
        "services",
        "describe",
        service,
        `--project=${project}`,
        `--region=${region}`,
        "--format=json",
      ],
      { signal: deadline, timeout: LIMIT_MS },
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          const svc = JSON.parse(stdout);
          const ready = (svc.status?.conditions ?? []).some(
            (c) => c.type === "Ready" && c.status === "True",
          );
          const minScale =
            svc.spec?.template?.metadata?.annotations?.["autoscaling.knative.dev/minScale"];
          resolve({ ready, url: svc.status?.url ?? null, minInstances: Number(minScale ?? 0) });
        } catch {
          resolve(null);
        }
      },
    );
  });
}

const { ok, checks } = await checkStreamReady(
  apiBase,
  { fetchJson, describeRenderer },
  { probeRenderer: args.includes("--probe-renderer") },
);
console.log(`stream:ready ${new URL(apiBase).host}`);
for (const c of checks) console.log(`  ${c.result.padEnd(4)} ${c.name}: ${c.detail}`);
console.log(ok ? "READY" : "NOT READY");
process.exit(ok ? 0 : 1);
