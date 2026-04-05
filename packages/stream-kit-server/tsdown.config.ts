import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  sourcemap: true,
  clean: false,
  target: "node18",
  platform: "node",
  treeshake: true,
  dts: false,
  deps: {
    neverBundle: [
      "@open-game-system/stream-kit-types",
      "puppeteer",
      "puppeteer-stream",
      "peerjs",
      "events",
      "http",
    ],
    alwaysBundle: ["fast-json-patch"],
  },
});
