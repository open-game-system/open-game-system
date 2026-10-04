import path from "node:path";
import { defineConfig } from "vitest/config";

const src = (pkg: string, file = "src/index.ts") => path.resolve(__dirname, `../${pkg}/${file}`);

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
