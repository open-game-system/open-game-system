import app from "../../src/index";
import { createD1 } from "./d1";

/**
 * `cloudflare:test` for the integration suite running in Node (vitest.mutation.config.mts): the
 * same bindings as vitest.integration.config.mts, D1 on Node's SQLite, and SELF calling the Hono
 * app directly. No Durable Objects and no OIDC emulators: tests that need them stay workerd-only.
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
};

const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };

export const SELF = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    app.fetch(new Request(input, init), env, ctx),
};
