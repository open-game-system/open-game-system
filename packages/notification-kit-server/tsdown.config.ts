import { defineConfig } from "tsdown";

// Bundles ogs-protocol (not on npm at this version); zod stays a dependency.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { resolve: [/^@open-game-system\//] },
  clean: true,
  deps: { alwaysBundle: [/^@open-game-system\//], neverBundle: ["zod"] },
});
