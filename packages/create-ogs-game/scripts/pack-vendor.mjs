#!/usr/bin/env node
// Packs the OGS packages a new game needs (they are not on npm yet) into vendor/:
//   vendor/game/  profile-kit, cast-kit-core, cast-kit-react and their workspace deps (the web game)
//   vendor/app/   @open-game-system/shell and its workspace deps (the Expo app)
// Each folder gets vendor.json: { direct: { name: file }, overrides: { name: file } }. The CLI copies
// the tarballs into the new game and writes file: dependencies plus pnpm.overrides (a packed package
// names its workspace deps by version, which is not on npm).
//
// Build first: pnpm --filter "@open-game-system/shell..." --filter "@open-game-system/profile-kit..." \
//   --filter "@open-game-system/cast-kit-react..." run build   (or just: pnpm --filter create-ogs-game vendor)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const here = import.meta.dirname;
const packages = resolve(here, "../..");
const out = resolve(here, "../vendor");
const dirOf = (name) => join(packages, name.replace("@open-game-system/", ""));

/** The roots and their workspace dependencies, transitively, roots first. */
function closure(roots) {
  const names = [];
  const visit = (name) => {
    if (names.includes(name)) return;
    names.push(name);
    const pkg = JSON.parse(readFileSync(join(dirOf(name), "package.json"), "utf8"));
    for (const [dep, spec] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies }))
      if (String(spec).startsWith("workspace:")) visit(dep);
  };
  for (const r of roots) visit(r);
  return names;
}

function pack(group, roots) {
  const dest = join(out, group);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const files = {};
  for (const name of closure(roots)) {
    const printed = execFileSync("pnpm", ["pack", "--pack-destination", dest], {
      cwd: dirOf(name),
      encoding: "utf8",
    });
    files[name] = basename(printed.trim().split("\n").pop());
  }
  const direct = Object.fromEntries(roots.map((r) => [r, files[r]]));
  const overrides = Object.fromEntries(Object.entries(files).filter(([n]) => !roots.includes(n)));
  writeFileSync(join(dest, "vendor.json"), `${JSON.stringify({ direct, overrides }, null, 2)}\n`);
  console.log(`vendor/${group}: ${Object.values(files).join(", ")}`);
}

pack("game", [
  "@open-game-system/profile-kit",
  "@open-game-system/cast-kit-core",
  "@open-game-system/cast-kit-react",
]);
pack("app", ["@open-game-system/shell"]);
