import { defineConfig } from "vitest/config";

/** Browser tests: a Vite dev server in fake mode, driven by Playwright at 1920×1080. */
export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.ts"],
    globalSetup: ["e2e/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
