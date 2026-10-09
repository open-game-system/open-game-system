import { defineConfig } from "tsdown";

// Games install this from a packed tarball like profile-kit: ogs-protocol is bundled in, zod stays a
// dependency.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { resolve: [/^@open-game-system\//] },
  clean: true,
  deps: { alwaysBundle: [/^@open-game-system\//], neverBundle: ["zod"] },
});
