import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: /e2e\.spec\.ts/,
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
});
