// @vitest-environment node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

/**
 * Games bundle profile-kit for the browser (esbuild, platform=browser) from its packed dist. Guard:
 * the built ESM entries resolve with no Node built-ins (an inlined CJS dependency once pulled in
 * `node:module`). Runs on the built dist (turbo builds before test).
 */
const dist = resolve(__dirname, "../dist");

describe.each(["index.mjs", "react.mjs", "server.mjs"])("dist/%s in a browser bundle", (entry) => {
  it("bundles with esbuild for the browser (no node: imports)", async () => {
    const file = resolve(dist, entry);
    expect(existsSync(file), `${file} missing: run pnpm build first`).toBe(true);
    const out = await build({
      entryPoints: [file],
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      logLevel: "silent",
      external: ["react"],
    });
    const code = out.outputFiles.map((f) => f.text).join("\n");
    expect(code).not.toMatch(/node:/);
    expect(code).not.toMatch(/createRequire/);
  });
});
