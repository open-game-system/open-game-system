import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: /e2e\.spec\.ts/,
  timeout: 240_000,
  expect: {
    timeout: 45_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
});
