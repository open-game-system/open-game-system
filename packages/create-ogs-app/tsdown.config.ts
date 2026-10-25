import { defineConfig } from "tsdown";

// The bin (`create-ogs-app`) and the library (`create-ogs-app/lib`, used by create-ogs-game) as ESM;
// the template ships next to dist/ as plain files.
export default defineConfig({
  entry: ["src/bin.ts", "src/lib.ts"],
  format: ["esm"],
  platform: "node",
  dts: false,
  clean: true,
  deps: { neverBundle: ["zod"] },
});
