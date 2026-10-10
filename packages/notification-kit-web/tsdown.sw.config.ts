import { defineConfig } from "tsdown";

// sw.js: a classic service-worker script the game copies to its origin root. Everything bundled in;
// the build renames sw.iife.js to sw.js.
export default defineConfig({
  entry: { sw: "src/sw.ts" },
  format: ["iife"],
  dts: false,
  clean: false,
  minify: true,
  deps: { alwaysBundle: [/.*/] },
});
