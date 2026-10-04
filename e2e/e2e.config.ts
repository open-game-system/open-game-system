import type { E2EConfig } from "e2e";
import { mobile } from "@e2e-dev/mobile";
import { web } from "@e2e-dev/web";

// One target per surface (the framework drives one device per test). Cross-device truth lives in
// the API's seam tests and couch-flow.mjs; these prove each surface on its own.
// No model is configured: every test here is deterministic. Agent steps need `e2e login` or a key.
export default {
  targets: [
    {
      name: "launcher",
      engine: web({ viewport: { width: 1920, height: 1080 } }),
      app: { url: "http://localhost:5180" },
    },
    {
      name: "ios",
      engine: mobile({ platform: "ios" }),
      app: {
        bundleId: "org.opengame.app",
        launchArguments: ["--initialUrl", "http://localhost:8081", "-EXDevMenuShowsAtLaunch", "NO", "-EXDevMenuIsOnboardingFinished", "YES"],
      },
    },
  ],
  workers: 1,
} satisfies E2EConfig;
