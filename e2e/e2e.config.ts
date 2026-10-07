import { mobile } from "@e2e-dev/mobile";
import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

// One target per surface (the framework drives one device per test). Cross-device truth lives in
// the API's seam tests and couch-flow.mjs; these prove each surface on its own.
// No model is configured: every test here is deterministic. Agent steps need `e2e login` or a key.

/**
 * The browser engine, exported so a test can reach Playwright (a second page, the virtual clock) via
 * surfaceOf. The runner and the test file load this module separately, so the one instance lives on
 * globalThis: surfaceOf only knows the handle the runner drives.
 */
declare global {
  var __ogsWebEngine: ReturnType<typeof web> | undefined;
}
globalThis.__ogsWebEngine ??= web({ viewport: { width: 1920, height: 1080 } });
export const webEngine = globalThis.__ogsWebEngine;

export default {
  targets: [
    {
      name: "launcher",
      engine: webEngine,
      // OGS_LAUNCHER / OGS_API let a second stack run beside the shared one (5180 / 8788).
      app: { url: process.env.OGS_LAUNCHER ?? "http://localhost:5180" },
    },
    {
      name: "ios",
      // E2E_IOS_DEVICE / E2E_IOS_SESSION: drive your own simulator (by UDID) under your own
      // agent-device session; omitted, the pool is every booted simulator.
      engine: mobile({
        platform: "ios",
        device: process.env.E2E_IOS_DEVICE,
        session: process.env.E2E_IOS_SESSION,
      }),
      app: {
        // A Release simulator build with EXPO_PUBLIC_FAKE_CAST=1, EXPO_PUBLIC_OGS_API=http://localhost:8788.
        bundleId: "org.opengame.app",
      },
    },
  ],
  workers: 1,
} satisfies E2EConfig;
