import { defineConfig } from "tsdown";

// Games install profile-kit from a packed tarball (like cast-kit), and ogs-protocol and the app
// bridge are not on npm at these versions: bundle them in, keep only zod / fast-json-patch / react
// outside.
export default defineConfig({
  entry: ["src/index.ts", "src/react.tsx", "src/server.ts"],
  format: ["esm", "cjs"],
  dts: { resolve: [/^@open-game-system\//] },
  clean: true,
  deps: {
    alwaysBundle: [/^@open-game-system\//],
    neverBundle: ["react", "zod", "fast-json-patch"],
  },
});
