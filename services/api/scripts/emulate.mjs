#!/usr/bin/env node
// Local sign-in providers for dev and e2e (vercel-labs/emulate): Google and Apple (OIDC, RS256 ID
// tokens + JWKS). Point the API at them with the values in .dev.vars.example. Email needs no
// emulator: `wrangler dev` captures what the send_email binding sends (Local Explorer,
// /cdn-cgi/local/explorer/api/local/email/sending). Usage: pnpm emulate [--base 4100]
import { createEmulator } from "emulate";

const i = process.argv.indexOf("--base");
const base = i > 0 ? Number(process.argv[i + 1]) : 4100;
const people = ["jonathan", "mom", "juneau", "nana", "max"].map((n) => ({
  email: `${n}@example.com`,
  name: n[0].toUpperCase() + n.slice(1),
}));
const seed = {
  // No oauth_clients: the emulator then accepts any client id and redirect (PKCE apps have no secret).
  google: { users: people },
  apple: { users: people },
};
const running = await Promise.all([
  createEmulator({ service: "google", port: base + 2, seed }),
  createEmulator({ service: "apple", port: base + 4, seed }),
]);
for (const e of running) console.log(`emulate: ${e.url}`);
const stop = async () => {
  await Promise.all(running.map((e) => e.close()));
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
