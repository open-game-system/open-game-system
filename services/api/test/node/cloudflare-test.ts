import { createD1 } from "./d1";

// A fresh game-token signing key per test file, like vitest.integration.config.mts.
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const signingJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

/**
 * `cloudflare:test` for the integration suite running in Node (vitest.mutation.config.mts): the
 * same bindings as vitest.integration.config.mts, D1 on Node's SQLite, and SELF calling the Hono
 * app directly. No Durable Objects and no OIDC emulators: tests that need them stay workerd-only.
 * The app is imported on the first request, not here: this module loads in the setup file, and a
 * mutant that throws while src loads must fail tests, not the setup (which Stryker's vitest runner
 * reports as no failures at all).
 */
export const env = {
  DB: createD1(),
  OGS_JWT_SECRET: "test-jwt-secret",
  APPLE_ISSUER: "http://localhost:4204",
  APPLE_CLIENT_IDS: "org.opengame.app",
  GOOGLE_ISSUER: "http://localhost:4202",
  GOOGLE_CLIENT_IDS: "ogs-test.apps.googleusercontent.com",
  RESEND_BASE_URL: "http://localhost:4208",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "OGS <hello@opengame.org>",
  OGS_GAME_SIGNING_KEY: JSON.stringify({ ...signingJwk, kid: "k-integration" }),
  AVATAR_BASE_URL: "https://tv.test",
};

const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };

export const SELF = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const { default: app } = await import("../../src/index");
    return app.fetch(new Request(input, init), env, ctx);
  },
};
