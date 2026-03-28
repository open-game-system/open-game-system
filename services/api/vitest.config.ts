import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules", "container/**", "test/e2e/**", "test/integration/**"],
  },
  resolve: {
    alias: {
      // Mock cloudflare:workers for Vitest (only available in Workers runtime)
      "cloudflare:workers": path.resolve(__dirname, "test/__mocks__/cloudflare-workers.ts"),
    },
  },
});
