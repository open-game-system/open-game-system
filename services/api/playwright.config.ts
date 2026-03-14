import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 30_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
});
