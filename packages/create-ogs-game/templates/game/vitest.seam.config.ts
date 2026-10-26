import { defineConfig } from "vitest/config";

/**
 * Seam tests: a whole round over real WebSockets against a running Worker. GAME_ORIGIN points them
 * at a deploy (`GAME_ORIGIN=https://… pnpm smoke`); without it, e2e/global-setup.ts starts
 * `wrangler dev` on a free port.
 */
export default defineConfig({
  test: {
    // actor-kit's browser client imports fast-json-patch (CommonJS) by name: let Vite bundle it.
    server: { deps: { inline: ["actor-kit"] } },
    include: ["e2e/**/*.seam.test.ts"], globalSetup: ["e2e/global-setup.ts"], testTimeout: 60_000, hookTimeout: 120_000 },
});
