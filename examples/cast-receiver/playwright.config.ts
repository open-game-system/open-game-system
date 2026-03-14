import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: /receiver\.test\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  retries: 0,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
