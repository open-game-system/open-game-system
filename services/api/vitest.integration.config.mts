import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.toml",
      },
      miniflare: {
        bindings: {
          OGS_JWT_SECRET: "test-jwt-secret",
        },
      },
    }),
  ],
  test: {
    globals: true,
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["./test/integration/setup.ts"],
  },
});
