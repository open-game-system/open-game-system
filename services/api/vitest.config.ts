import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules", "test/e2e/**"],
  },
  resolve: {
    alias: {
      // Mock cloudflare:workers for Vitest (only available in Workers runtime)
      "cloudflare:workers": path.resolve(__dirname, "test/__mocks__/cloudflare-workers.ts"),
    },
  },
});
