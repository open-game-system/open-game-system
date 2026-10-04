import { realpathSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Workspace packages run from their source. Found through this package's own node_modules links
 * (not `../<pkg>` from here): Stryker runs the tests from a sandbox copy whose node_modules is a
 * link to this one, and a `../<pkg>` path from the sandbox points nowhere, so every suite that
 * imported one failed to load and Stryker counted all their mutants as survived.
 */
const src = (pkg: string, file = "src/index.ts") =>
  path.join(realpathSync(path.resolve(__dirname, "node_modules/@open-game-system", pkg)), file);

export default defineConfig({
  test: { environment: "jsdom" },
  resolve: {
    alias: {
      "@open-game-system/ogs-protocol": src("ogs-protocol"),
      "@open-game-system/app-bridge-web": src("app-bridge-web"),
      "@open-game-system/app-bridge-types": src("app-bridge-types"),
      "@open-game-system/app-bridge-testing": src("app-bridge-testing"),
    },
  },
});
