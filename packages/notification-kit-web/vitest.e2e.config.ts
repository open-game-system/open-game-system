import { defineConfig } from "vitest/config";

// The built sw.js in a real Chromium (Playwright), with pushes delivered through DevTools.
export default defineConfig({
  test: { include: ["e2e/**/*.e2e.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
});
