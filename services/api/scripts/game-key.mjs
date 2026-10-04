#!/usr/bin/env node
// Makes a fresh ES256 game-token signing key (OGS_GAME_SIGNING_KEY) for local dev and writes it
// into .dev.vars (never committed). Production: `node scripts/game-key.mjs --print | wrangler secret put OGS_GAME_SIGNING_KEY`.
import { webcrypto } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
const kid = `ogs-${new Date().toISOString().slice(0, 10)}-${webcrypto.randomUUID().slice(0, 8)}`;
const secret = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d, kid });

if (process.argv.includes("--print")) {
  process.stdout.write(secret);
} else {
  const file = new URL("../.dev.vars", import.meta.url);
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  const kept = lines.filter((l) => !l.startsWith("OGS_GAME_SIGNING_KEY="));
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  kept.push(`OGS_GAME_SIGNING_KEY='${secret}'`, "");
  writeFileSync(file, kept.join("\n"));
  console.log(`Wrote OGS_GAME_SIGNING_KEY (kid ${kid}) to .dev.vars`);
}
