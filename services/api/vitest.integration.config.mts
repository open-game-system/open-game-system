import { webcrypto } from "node:crypto";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// A fresh game-token signing key per run (slice 3), like the Worker secret OGS_GAME_SIGNING_KEY.
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
const OGS_GAME_SIGNING_KEY = JSON.stringify({ ...jwk, kid: "k-integration" });

// Apple/Google sign-in runs against vercel-labs/emulate (test/integration/global-setup.ts), never
// real providers; email goes to a recording outbox (test/integration/workers/email-outbox.mjs).
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          OGS_JWT_SECRET: "test-jwt-secret",
          APPLE_ISSUER: "http://localhost:4204",
          APPLE_CLIENT_IDS: "org.opengame.app",
          GOOGLE_ISSUER: "http://localhost:4202",
          GOOGLE_CLIENT_IDS: "ogs-test.apps.googleusercontent.com",
          OGS_GAME_SIGNING_KEY,
          AVATAR_BASE_URL: "https://tv.test",
        },
        // Email: the pool can't observe the local send_email binding, so SEND_EMAIL is bound to a
        // recording outbox with the same contract; tests read it through EMAIL_OUTBOX.
        email: { send_email: [] },
        serviceBindings: {
          SEND_EMAIL: { name: "email-outbox", entrypoint: "Outbox" },
          EMAIL_OUTBOX: { name: "email-outbox", entrypoint: "Outbox" },
        },
        workers: [
          {
            name: "email-outbox",
            modules: true,
            scriptPath: "./test/integration/workers/email-outbox.mjs",
            compatibilityDate: "2024-12-01",
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["./test/integration/setup.ts"],
    globalSetup: ["./test/integration/global-setup.ts"],
  },
});
