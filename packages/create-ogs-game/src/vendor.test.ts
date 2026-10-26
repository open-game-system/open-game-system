import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readVendor, vendorFiles, withVendor } from "./vendor";

const manifest = {
  direct: { "@open-game-system/profile-kit": "ogs-profile-kit-0.1.0.tgz" },
  overrides: { "@open-game-system/app-bridge-web": "ogs-app-bridge-web-0.1.0.tgz" },
};

describe("readVendor", () => {
  it("parses vendor.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "vendor-"));
    writeFileSync(join(dir, "vendor.json"), JSON.stringify(manifest));
    expect(readVendor(dir)).toEqual(manifest);
  });

  it("says how to make the vendor folder when it is missing", () => {
    expect(() => readVendor(join(tmpdir(), "nope-vendor"))).toThrow(
      /pnpm --filter create-ogs-game vendor/,
    );
  });

  it("refuses an entry that is not a tarball", () => {
    const dir = mkdtempSync(join(tmpdir(), "vendor-"));
    writeFileSync(
      join(dir, "vendor.json"),
      JSON.stringify({ direct: { a: "a.zip" }, overrides: {} }),
    );
    expect(() => readVendor(dir)).toThrow();
  });
});

describe("withVendor", () => {
  it("adds file: dependencies and overrides for every vendored package, keeping the rest", () => {
    const pkg = {
      name: "g",
      dependencies: { zod: "^3" },
      pnpm: { patchedDependencies: { x: "p" } },
    };
    expect(withVendor(pkg, manifest)).toEqual({
      name: "g",
      dependencies: {
        "@open-game-system/profile-kit": "file:vendor/ogs-profile-kit-0.1.0.tgz",
        zod: "^3",
      },
      pnpm: {
        patchedDependencies: { x: "p" },
        overrides: {
          "@open-game-system/app-bridge-web": "file:./vendor/ogs-app-bridge-web-0.1.0.tgz",
          "@open-game-system/profile-kit": "file:./vendor/ogs-profile-kit-0.1.0.tgz",
        },
      },
    });
  });

  it("lists each tarball once", () => {
    expect(vendorFiles({ direct: { a: "a.tgz" }, overrides: { b: "b.tgz", c: "a.tgz" } })).toEqual([
      "a.tgz",
      "b.tgz",
    ]);
  });
});

describe("vendor edges (mutation testing)", () => {
  it("only takes .tgz files, not names that merely contain it", () => {
    const dir = mkdtempSync(join(tmpdir(), "vendor-"));
    writeFileSync(
      join(dir, "vendor.json"),
      JSON.stringify({ direct: { a: "a.tgz.zip" }, overrides: {} }),
    );
    expect(() => readVendor(dir)).toThrow();
    writeFileSync(
      join(dir, "vendor.json"),
      JSON.stringify({ direct: {}, overrides: { a: "a.tgz.bak" } }),
    );
    expect(() => readVendor(dir)).toThrow();
  });

  it("keeps the project's own overrides and sorts dependencies and overrides by name", () => {
    const pkg = {
      dependencies: { zod: "^3", react: "^19" },
      pnpm: { overrides: { esbuild: "0.28" } },
    };
    const out = withVendor(pkg, manifest);
    expect(Object.keys(out.dependencies as object)).toEqual([
      "@open-game-system/profile-kit",
      "react",
      "zod",
    ]);
    expect(Object.keys((out.pnpm as { overrides: object }).overrides)).toEqual([
      "@open-game-system/app-bridge-web",
      "@open-game-system/profile-kit",
      "esbuild",
    ]);
  });
});
