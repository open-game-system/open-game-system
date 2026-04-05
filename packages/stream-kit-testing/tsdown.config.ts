import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  deps: {
    neverBundle: ["@open-game-system/stream-kit-types", "@open-game-system/stream-kit-web"],
  },
});
