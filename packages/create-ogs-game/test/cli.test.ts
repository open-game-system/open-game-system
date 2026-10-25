import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli";

function io() {
  const out: string[] = [];
  const err: string[] = [];
  const vendorDir = mkdtempSync(join(tmpdir(), "ogs-vendor-"));
  for (const group of ["game", "app"]) {
    mkdirSync(join(vendorDir, group));
    writeFileSync(
      join(vendorDir, group, "vendor.json"),
      JSON.stringify({ direct: {}, overrides: {} }),
    );
  }
  return {
    out,
    err,
    io: {
      cwd: mkdtempSync(join(tmpdir(), "ogs-cli-")),
      log: (m: string) => out.push(m),
      error: (m: string) => err.push(m),
      vendorDir,
    },
  };
}

describe("create-ogs-game", () => {
  it("makes a game and prints the next steps", async () => {
    const t = io();
    expect(await main(["kite-count", "--name", "Kite Count"], t.io)).toBe(0);
    expect(t.out.join("\n")).toContain("cd kite-count");
    expect(t.out.join("\n")).toContain("pnpm run deploy:preview");
    expect(t.out.join("\n")).toContain("No Team ID yet");
  });

  it("prints help", async () => {
    const t = io();
    expect(await main(["--help"], t.io)).toBe(0);
    expect(t.out[0]).toContain("pnpm create ogs-game");
  });

  it("exits 2 on bad flags or a template name, 1 when the directory is taken", async () => {
    const t = io();
    expect(await main(["--bogus"], t.io)).toBe(2);
    expect(await main(["--name", "My Game"], t.io)).toBe(2);
    expect(t.err.join("\n")).toContain("4.3");
    expect(await main(["kc", "--name", "Kite Count"], t.io)).toBe(0);
    expect(await main(["kc", "--name", "Kite Count"], t.io)).toBe(1);
  });
});
