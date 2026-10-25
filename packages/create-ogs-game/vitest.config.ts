import { defineConfig } from "vitest/config";

export default defineConfig({
  // The generate tests write whole games: give a busy machine room.
  test: { include: ["src/**/*.test.ts", "test/**/*.test.ts"], testTimeout: 30_000 },
});
