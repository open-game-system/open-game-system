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
