#!/usr/bin/env node
// Beta release steps for .github/workflows/mobile-release.yml (docs/adrs/2026-10-07-beta-distribution.md).
// Node 24 (type stripping) runs it from apps/mobile:
//   node scripts/release/release.mjs plan                 → ios_build/android_build + fingerprints to $GITHUB_OUTPUT
//   node scripts/release/release.mjs wait-testflight <build>   → waits until App Store Connect says VALID
//   node scripts/release/release.mjs record <platform> <build> <fingerprint> <updateUrl>
// Env: OGS_API (default: the beta profile's EXPO_PUBLIC_OGS_API), RELEASE_TOKEN,
//      ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, ASC_APP_ID (wait-testflight).
import { execFileSync } from "node:child_process";
import { createPrivateKey, sign } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { needsBuild, parseRecorded, testflightState } from "./release-lib.ts";

const eas = JSON.parse(readFileSync(new URL("../../eas.json", import.meta.url), "utf8"));
const api = (process.env.OGS_API || eas.build.beta.env.EXPO_PUBLIC_OGS_API).replace(/\/+$/, "");

function need(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function output(key, value) {
  console.log(`${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

/** The runtime version expo-updates embeds in a build of this platform (the native fingerprint). */
function fingerprint(platform) {
  const raw = execFileSync(
    "pnpm",
    ["exec", "expo-updates", "runtimeversion:resolve", "--platform", platform],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const runtimeVersion = JSON.parse(raw).runtimeVersion;
  if (typeof runtimeVersion !== "string" || !runtimeVersion) throw new Error("no runtime version");
  return runtimeVersion;
}

async function plan() {
  for (const platform of ["ios", "android"]) {
    const res = await fetch(`${api}/api/v1/app-release/${platform}`);
    const text = await res.text();
    const recorded = parseRecorded(res.status, res.status === 200 ? JSON.parse(text) : text);
    const print = fingerprint(platform);
    output(`${platform}_fingerprint`, print);
    output(`${platform}_build`, String(needsBuild(print, recorded)));
  }
}

/** App Store Connect API token: ES256 JWT, 15 minutes. */
function ascToken() {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: need("ASC_KEY_ID"), typ: "JWT" });
  const body = b64({
    iss: need("ASC_ISSUER_ID"),
    iat: now,
    exp: now + 900,
    aud: "appstoreconnect-v1",
  });
  const key = createPrivateKey(need("ASC_KEY_P8").replace(/\\n/g, "\n"));
  const signature = sign("sha256", Buffer.from(`${head}.${body}`), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${signature.toString("base64url")}`;
}

async function waitTestflight(build) {
  const app = need("ASC_APP_ID");
  const url = `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${app}&filter[version]=${build}&fields[builds]=processingState&limit=1`;
  const deadline = Date.now() + 90 * 60 * 1000;
  while (Date.now() < deadline) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ascToken()}` } });
    const state = testflightState(await res.json());
    console.log(`TestFlight build ${build}: ${state}`);
    if (state === "ready") return;
    if (state === "failed") throw new Error(`App Store Connect rejected build ${build}`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new Error(`build ${build} was still not ready after 90 minutes`);
}

async function record(platform, build, print, updateUrl) {
  const res = await fetch(`${api}/api/v1/app-release/${platform}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${need("RELEASE_TOKEN")}`,
    },
    body: JSON.stringify({ build: Number(build), fingerprint: print, updateUrl }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`recording the release answered ${res.status}: ${body}`);
  console.log(`recorded ${platform} build ${build}: ${body}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "plan") await plan();
else if (command === "wait-testflight") await waitTestflight(args[0]);
else if (command === "record") await record(args[0], args[1], args[2], args[3]);
else {
  console.error(
    "usage: release.mjs plan | wait-testflight <build> | record <platform> <build> <fingerprint> <updateUrl>",
  );
  process.exit(2);
}
