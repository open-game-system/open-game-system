import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  appAnswers,
  generateGame,
  TargetNotEmptyError,
  TEMPLATES_DIR,
  VENDOR_DIR,
} from "../src/generate";
import type { GameAnswers } from "../src/options";

const answers: GameAnswers = {
  dir: "kite-count",
  name: "Kite Count",
  appId: "kite-count",
  bundleId: "tv.kitecount.app",
  teamId: "",
};

/** A vendor folder like scripts/pack-vendor.mjs makes, with empty tarballs. */
function fakeVendor(): string {
  const dir = mkdtempSync(join(tmpdir(), "ogs-vendor-"));
  const groups = {
    game: {
      direct: { "@open-game-system/profile-kit": "pk.tgz" },
      overrides: { "@open-game-system/app-bridge-web": "abw.tgz" },
    },
    app: {
      direct: { "@open-game-system/shell": "shell.tgz" },
      overrides: { "@open-game-system/ogs-protocol": "proto.tgz" },
    },
  };
  for (const [group, manifest] of Object.entries(groups)) {
    mkdirSync(join(dir, group));
    writeFileSync(join(dir, group, "vendor.json"), JSON.stringify(manifest));
    for (const f of [...Object.values(manifest.direct), ...Object.values(manifest.overrides)])
      writeFileSync(join(dir, group, f), "");
  }
  return dir;
}

let target = "";
let files: string[] = [];
const read = (p: string) => readFileSync(join(target, p), "utf8");
const json = (p: string): unknown => JSON.parse(read(p));

beforeAll(async () => {
  target = join(mkdtempSync(join(tmpdir(), "ogs-game-")), "kite-count");
  files = await generateGame({
    targetDir: target,
    answers,
    vendorDir: fakeVendor(),
    secret: () => "s3cret",
  });
});

describe("generateGame", () => {
  it("leaves no template placeholder anywhere", () => {
    for (const f of files.filter((f) => !f.endsWith(".tgz") && !f.endsWith(".png"))) {
      expect(read(f), f).not.toMatch(/__OGS_[A-Z_]+__/);
    }
  });

  it("writes the web game: Worker, Durable Object, TV and phone pages, tests, CI", () => {
    for (const f of [
      "package.json",
      "wrangler.jsonc",
      "src/worker.ts",
      "src/room.server.ts",
      "src/room.machine.ts",
      "src/client/tv.tsx",
      "src/client/phone.tsx",
      "e2e/round.seam.test.ts",
      ".github/workflows/ci.yml",
      ".gitignore",
      "README.md",
      "patches/actor-kit@0.52.6.patch",
    ]) {
      expect(files).toContain(f);
    }
    expect(read("src/game.config.ts")).toContain('appId: "kite-count"');
    expect(read("wrangler.jsonc")).toContain('"name": "kite-count-preview"');
  });

  it("vendors the OGS packages the game needs, with overrides", () => {
    expect(json("package.json")).toMatchObject({
      name: "kite-count",
      dependencies: { "@open-game-system/profile-kit": "file:vendor/pk.tgz" },
      pnpm: { overrides: { "@open-game-system/app-bridge-web": "file:./vendor/abw.tgz" } },
    });
    expect(existsSync(join(target, "vendor/pk.tgz"))).toBe(true);
  });

  it("keeps package.json's name first", () => {
    expect(read("package.json").split("\n")[1]).toContain('"name": "kite-count"');
  });

  it("writes a git-ignored .dev.vars with a fresh actor-kit secret", () => {
    expect(read(".dev.vars")).toBe("ACTOR_KIT_SECRET=s3cret\n");
    expect(read(".gitignore")).toContain(".dev.vars");
  });

  it("makes the app with AirPlay on, the Worker's URL from deploys.json, its ids and the vendored shell", () => {
    const config = read("app/app.config.ts");
    expect(config).toContain('cast: { receiver: "ogs", airplay: true }');
    expect(config).toContain("deploys.json");
    expect(config).toContain('bundleIdentifier: "tv.kitecount.app"');
    expect(config).toContain('name: "Kite Count"');
    expect(json("app/package.json")).toMatchObject({
      name: "kite-count-app",
      dependencies: { "@open-game-system/shell": "file:vendor/shell.tgz", zod: "^3.25.76" },
      scripts: {
        "e2e:ios": "e2e/sim.sh",
        "e2e:record": "e2e/record.sh",
        presubmit: "node scripts/presubmit.mjs",
      },
      pnpm: { overrides: { "@open-game-system/ogs-protocol": "file:./vendor/proto.tgz" } },
    });
  });

  it("sets which deploy each EAS profile opens", () => {
    expect(json("app/eas.json")).toMatchObject({
      build: {
        production: { env: { APP_ENV: "production" } },
        preview: { env: { APP_ENV: "preview" } },
      },
    });
  });

  it("drops create-ogs-app's add-to-an-existing-game examples and the made-up URL", () => {
    expect(files.some((f) => f.startsWith("app/examples/"))).toBe(false);
    for (const doc of ["app/README.md", "app/REVIEW_NOTES.md"])
      expect(read(doc)).not.toContain("undeployed.invalid");
  });

  it("ignores the simulator walk's output", () => {
    expect(read("app/.gitignore")).toContain("e2e/out/");
  });

  it("ships the simulator walk executable, and the placeholder art's hashes for the pre-submit check", () => {
    expect(statSync(join(target, "app/e2e/sim.sh")).mode & 0o111).not.toBe(0);
    expect(statSync(join(target, "app/e2e/external-display.sh")).mode & 0o111).not.toBe(0);
    expect(statSync(join(target, "app/e2e/record.sh")).mode & 0o111).not.toBe(0);
    const hashes = JSON.parse(read("app/placeholder-assets.json"));
    expect(Object.keys(hashes).sort()).toEqual([
      "assets/adaptive-icon.png",
      "assets/icon.png",
      "assets/splash-icon.png",
    ]);
  });

  it("tells developers to submit from their own Apple account (4.2.6) and not to ship the template (4.3)", () => {
    const readme = read("README.md");
    expect(readme).toContain("4.2.6");
    expect(readme).toContain("4.3");
    expect(readme).toContain("own Apple Developer account");
  });

  it("refuses a directory that isn't empty, before writing anything", async () => {
    await expect(
      generateGame({ targetDir: target, answers, vendorDir: fakeVendor() }),
    ).rejects.toBeInstanceOf(TargetNotEmptyError);
  });

  it("refuses to start without the vendored packages", async () => {
    const empty = mkdtempSync(join(tmpdir(), "ogs-novendor-"));
    const dir = join(mkdtempSync(join(tmpdir(), "ogs-game-")), "g");
    await expect(generateGame({ targetDir: dir, answers, vendorDir: empty })).rejects.toThrow(
      /vendor/,
    );
    expect(existsSync(dir)).toBe(false);
  });
});

describe("generateGame edges (mutation testing)", () => {
  it("lists every file it wrote, sorted, the app's included, its examples not", () => {
    expect(files).toEqual([...files].sort());
    expect(new Set(files).size).toBe(files.length);
    expect(files).toContain("app/app.config.ts");
    expect(files).toContain("app/app/index.tsx");
    expect(files).toContain("app/vendor/shell.tgz");
    expect(files).toContain("app/placeholder-assets.json");
    expect(files).toContain("vendor/abw.tgz");
  });

  it("names the Worker's URL as a placeholder in the app's docs", () => {
    expect(read("app/README.md")).toContain("`<your Worker>/host`");
    expect(read("app/REVIEW_NOTES.md")).toContain("`<your Worker>` (`../deploys.json`)");
  });

  it("ends the app's .gitignore with one blank line before the e2e entry", () => {
    expect(read("app/.gitignore")).toMatch(/[^\n]\n\n# e2e\/sim\.sh output\ne2e\/out\/\n$/);
  });

  it("hashes the placeholder art with SHA-256", () => {
    for (const hash of Object.values(JSON.parse(read("app/placeholder-assets.json")))) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("makes a fresh 64-hex-digit secret by default, and writes into an empty directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ogs-empty-"));
    await generateGame({ targetDir: dir, answers, vendorDir: fakeVendor() });
    expect(readFileSync(join(dir, ".dev.vars"), "utf8")).toMatch(
      /^ACTOR_KIT_SECRET=[0-9a-f]{64}\n$/,
    );
  });

  it("names the error and the directory when it is taken", async () => {
    const error = await generateGame({ targetDir: target, answers, vendorDir: fakeVendor() }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(TargetNotEmptyError);
    if (error instanceof Error) {
      expect(error.name).toBe("TargetNotEmptyError");
      expect(error.message).toBe(`${target} is not empty: pick a new directory`);
    }
  });

  it("copies a template without .DS_Store or node_modules, and makes only .sh files executable", async () => {
    const templates = mkdtempSync(join(tmpdir(), "ogs-templates-"));
    for (const f of [
      "game/package.json",
      "game/run.sh",
      "game/notes.txt",
      "game/.DS_Store",
      "game/node_modules/x/index.js",
    ]) {
      mkdirSync(join(templates, f, ".."), { recursive: true });
      writeFileSync(
        join(templates, f),
        f.endsWith("package.json") ? '{"name":"__OGS_APP_ID__"}' : "x",
      );
    }
    mkdirSync(join(templates, "app-overlay"));
    const dir = join(mkdtempSync(join(tmpdir(), "ogs-game-")), "g");
    const written = await generateGame({
      targetDir: dir,
      answers,
      templatesDir: templates,
      vendorDir: fakeVendor(),
      secret: () => "s",
    });
    expect(written).not.toContain(".DS_Store");
    expect(written.some((f) => f.includes("node_modules"))).toBe(false);
    expect(statSync(join(dir, "run.sh")).mode & 0o111).not.toBe(0);
    expect(statSync(join(dir, "notes.txt")).mode & 0o111).toBe(0);
  });

  it("finds its vendor folder next to src/", () => {
    expect(VENDOR_DIR.replace(/vendor\/$/, "templates/")).toBe(TEMPLATES_DIR);
  });
});

describe("appAnswers", () => {
  it("turns a bundle id into a valid Android package", () => {
    expect(appAnswers({ ...answers, bundleId: "com.my-studio.9lives" }).androidPackage).toBe(
      "com.my_studio.a9lives",
    );
  });
});
