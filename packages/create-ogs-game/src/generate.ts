import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Answers as AppAnswers,
  AnswersSchema as AppAnswersSchema,
  ASSETS,
  generateApp,
  placeholderValues,
  renderTemplate,
} from "create-ogs-app/lib";
import { z } from "zod";
import type { GameAnswers } from "./options";
import { readVendor, vendorFiles, withVendor } from "./vendor";

/** templates/ and vendor/ ship next to src/ and dist/. */
export const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));
export const VENDOR_DIR = fileURLToPath(new URL("../vendor/", import.meta.url));

export class TargetNotEmptyError extends Error {
  constructor(readonly dir: string) {
    super(`${dir} is not empty: pick a new directory`);
    this.name = "TargetNotEmptyError";
  }
}

/** npm drops dotfiles like .gitignore from a package, so templates keep them without the dot. */
const RENAMES: Record<string, string> = {
  gitignore: ".gitignore",
  _github: ".github",
};

/** A placeholder the game's own Worker URL replaces (deploys.json): the app needs an https gameUrl. */
const UNDEPLOYED = (appId: string) => `https://${appId}.undeployed.invalid/host`;

/** The app half's answers, in create-ogs-app's terms. */
export function appAnswers(a: GameAnswers): AppAnswers {
  return AppAnswersSchema.parse({
    dir: "app",
    appId: a.appId,
    name: a.name,
    gameUrl: UNDEPLOYED(a.appId),
    bundleId: a.bundleId,
    androidPackage: a.bundleId
      .split(".")
      .map((part) => part.replace(/-/g, "_").replace(/^(?![a-zA-Z])/, "a"))
      .join("."),
    teamId: a.teamId,
    linkDomains: [],
    branding: "hidden",
    shellVersion: "file:vendor",
  });
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name !== ".DS_Store" && !e.parentPath.includes("node_modules"))
    .map((e) => relative(dir, join(e.parentPath, e.name)).split("\\").join("/"));
}

const renamed = (path: string) =>
  path
    .split("/")
    .map((s) => RENAMES[s] ?? s)
    .join("/");

/** Copies a template folder into `to`, filling every `__OGS_<NAME>__`. Returns the paths written. */
async function copyTemplate(
  from: string,
  to: string,
  values: ReturnType<typeof placeholderValues>,
) {
  const written: string[] = [];
  for (const file of await listFiles(from)) {
    const target = join(to, renamed(file));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, renderTemplate(await readFile(join(from, file), "utf8"), values));
    if (file.endsWith(".sh")) await chmod(target, 0o755);
    written.push(renamed(file));
  }
  return written;
}

async function vendorInto(project: string, groupDir: string): Promise<string[]> {
  const manifest = readVendor(groupDir);
  await mkdir(join(project, "vendor"), { recursive: true });
  for (const file of vendorFiles(manifest))
    await copyFile(join(groupDir, file), join(project, "vendor", file));
  const pkgPath = join(project, "package.json");
  const pkg: unknown = JSON.parse(await readFile(pkgPath, "utf8"));
  await writeFile(pkgPath, `${JSON.stringify(withVendor(pkg, manifest), null, 2)}\n`);
  return vendorFiles(manifest).map((f) => `vendor/${f}`);
}

/** Keeps the keys' order of a JSON object while changing some of them. */
function merged(raw: unknown, changes: Record<string, unknown>): Record<string, unknown> {
  const base = z.record(z.unknown()).parse(raw);
  return { ...base, ...changes };
}

async function editJson(path: string, edit: (raw: unknown) => Record<string, unknown>) {
  await writeFile(
    path,
    `${JSON.stringify(edit(JSON.parse(await readFile(path, "utf8"))), null, 2)}\n`,
  );
}

const AppPackageSchema = z.object({
  scripts: z.record(z.string()),
  dependencies: z.record(z.string()),
});
const EasSchema = z.object({ build: z.record(z.record(z.unknown())) });

/**
 * The app's own commands (the simulator walk, the pre-submit check), zod for app.config.ts, and
 * which deploy each EAS profile opens (APP_ENV: app.config.ts reads ../deploys.json).
 */
async function finishApp(appDir: string) {
  // The simulator walk's screenshots and logs.
  const ignore = join(appDir, ".gitignore");
  await writeFile(
    ignore,
    `${(await readFile(ignore, "utf8")).trimEnd()}\n\n# e2e/sim.sh output\ne2e/out/\n`,
  );
  await editJson(join(appDir, "package.json"), (raw) => {
    const pkg = AppPackageSchema.parse(raw);
    return merged(raw, {
      scripts: {
        ...pkg.scripts,
        "e2e:ios": "e2e/sim.sh",
        "e2e:record": "e2e/record.sh",
        presubmit: "node scripts/presubmit.mjs",
      },
      dependencies: { ...pkg.dependencies, zod: "^3.25.76" },
    });
  });
  await editJson(join(appDir, "eas.json"), (raw) => {
    const eas = EasSchema.parse(raw);
    const build = Object.fromEntries(
      Object.entries(eas.build).map(([profile, settings]) => [
        profile,
        { ...settings, env: { APP_ENV: profile === "production" ? "production" : "preview" } },
      ]),
    );
    return merged(raw, { build });
  });
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/**
 * Writes a new game into `targetDir` (missing or empty):
 * - the web game (TV page, phone page, Worker with one Durable Object per room) from templates/game;
 * - `app/`: create-ogs-app's Expo shell app, then templates/app-overlay on top (AirPlay on, the
 *   Worker's URL from deploys.json, simulator e2e, the pre-submit check);
 * - the OGS packages that aren't on npm yet, in vendor/ and app/vendor/;
 * - `.dev.vars` with a fresh ACTOR_KIT_SECRET (git-ignored).
 */
export async function generateGame(opts: {
  targetDir: string;
  answers: GameAnswers;
  templatesDir?: string;
  vendorDir?: string;
  secret?: () => string;
}): Promise<string[]> {
  const { targetDir, answers } = opts;
  const templates = opts.templatesDir ?? TEMPLATES_DIR;
  const vendor = opts.vendorDir ?? VENDOR_DIR;
  if (existsSync(targetDir) && (await readdir(targetDir)).length > 0)
    throw new TargetNotEmptyError(targetDir);
  // Check the vendored packages before writing anything.
  readVendor(join(vendor, "game"));
  readVendor(join(vendor, "app"));

  const app = appAnswers(answers);
  const values = placeholderValues(app);
  const files = await copyTemplate(join(templates, "game"), targetDir, values);
  files.push(...(await vendorInto(targetDir, join(vendor, "game"))));
  const secret = opts.secret ?? (() => randomBytes(32).toString("hex"));
  await writeFile(join(targetDir, ".dev.vars"), `ACTOR_KIT_SECRET=${secret()}\n`);
  files.push(".dev.vars");

  const appDir = join(targetDir, "app");
  const appFiles = await generateApp({ targetDir: appDir, answers: app });
  // The game itself is the example: create-ogs-app's snippets are for adding OGS to an existing game.
  await rm(join(appDir, "examples"), { recursive: true, force: true });
  const overlay = await copyTemplate(join(templates, "app-overlay"), appDir, values);
  // The Worker's URL is known after the first deploy (deploys.json): say so where the text names it.
  for (const doc of ["README.md", "REVIEW_NOTES.md"]) {
    const path = join(appDir, doc);
    const text = (await readFile(path, "utf8")).replaceAll(app.gameUrl, "`<your Worker>/host`");
    await writeFile(
      path,
      text.replaceAll(new URL(app.gameUrl).origin, "`<your Worker>` (`../deploys.json`)"),
    );
  }
  const appVendor = await vendorInto(appDir, join(vendor, "app"));
  await finishApp(appDir);
  // The icon and splash are drawn placeholders: the pre-submit check refuses them (guideline 4.3).
  const placeholders = Object.fromEntries(
    await Promise.all(
      ASSETS.map(async (a) => [a.path, sha256(await readFile(join(appDir, a.path)))] as const),
    ),
  );
  await writeFile(
    join(appDir, "placeholder-assets.json"),
    `${JSON.stringify(placeholders, null, 2)}\n`,
  );
  const inApp = [
    ...appFiles.filter((f) => !f.startsWith("examples/")),
    ...overlay,
    ...appVendor,
    "placeholder-assets.json",
  ];
  files.push(...[...new Set(inApp)].map((f) => `app/${f}`));
  return [...new Set(files)].sort();
}
