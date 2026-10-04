import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { webcrypto } from "node:crypto";
import { defineConfig } from "vitest/config";

// A fresh game-token signing key per run (slice 3), like the Worker secret OGS_GAME_SIGNING_KEY.
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
const OGS_GAME_SIGNING_KEY = JSON.stringify({ ...jwk, kid: "k-integration" });

// Sign-in runs against vercel-labs/emulate (test/integration/global-setup.ts), never real providers.
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
          RESEND_BASE_URL: "http://localhost:4208",
          RESEND_API_KEY: "re_test_key",
          EMAIL_FROM: "OGS <hello@opengame.org>",
          OGS_GAME_SIGNING_KEY,
          AVATAR_BASE_URL: "https://tv.test",
        },
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
