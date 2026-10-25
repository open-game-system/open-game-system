/**
 * `pnpm run deploy` (production) or `pnpm run deploy:preview`: tests, wrangler deploy, the
 * ACTOR_KIT_SECRET on first deploy, deploys.json for the app, then a health check.
 * (`pnpm run deploy`, never `pnpm deploy`: that is pnpm's own workspace command.)
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { deployedUrl, withDeploy } from "./deploy-output";

const env = process.argv.includes("--env") && process.argv[process.argv.indexOf("--env") + 1] === "preview" ? "preview" : "production";
const envArgs = env === "preview" ? ["--env", "preview"] : [];
const wrangler = (args: string[], opts: { input?: string; outFile?: string } = {}) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args, ...envArgs], {
    encoding: "utf8",
    input: opts.input,
    stdio: [opts.input === undefined ? "inherit" : "pipe", "pipe", "inherit"],
    env: { ...process.env, ...(opts.outFile ? { WRANGLER_OUTPUT_FILE_PATH: opts.outFile } : {}) },
  });

const outFile = join(mkdtempSync(join(tmpdir(), "deploy-")), "out.ndjson");
console.log(`Deploying ${env}…`);
process.stdout.write(wrangler(["deploy"], { outFile }));
const url = deployedUrl(readFileSync(outFile, "utf8"));
if (!url) throw new Error("wrangler deployed but printed no workers.dev URL (is workers_dev off?)");

const SecretsSchema = z.array(z.object({ name: z.string() }));
const secrets = SecretsSchema.parse(JSON.parse(wrangler(["secret", "list", "--format", "json"])));
if (!secrets.some((s) => s.name === "ACTOR_KIT_SECRET")) {
  console.log("First deploy: setting ACTOR_KIT_SECRET (random, never printed)…");
  wrangler(["secret", "put", "ACTOR_KIT_SECRET"], { input: randomBytes(32).toString("hex") });
}

const file = "deploys.json";
const current: unknown = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
writeFileSync(file, `${JSON.stringify(withDeploy(current, env, url), null, 2)}\n`);

// A new secret makes a new version: give it a moment, then check the Worker answers.
for (let i = 0; i < 10; i++) {
  const res = await fetch(`${url}/healthz`).catch(() => null);
  if (res?.ok) {
    console.log(`\n${env} is live: ${url}\n  phone: ${url}/host\n  deploys.json updated (the app reads it).`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
throw new Error(`${url}/healthz did not answer`);
