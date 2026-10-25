#!/usr/bin/env node
// `pnpm presubmit`: the checks to pass before an App Store submission. Apple rejects apps built from
// a template that look like it (guideline 4.3, spam / near-identical apps) and apps a template
// service submits for someone else (4.2.6): submit from YOUR OWN Apple Developer account, with your
// own name, icon, screenshots and game. This catches the mechanical part; the rest is a checklist.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const app = new URL("..", import.meta.url).pathname;
const failures = [];
const fail = (msg) => failures.push(msg);
const read = (p) => readFileSync(join(app, p));

// 1. The icon and splash are not the generated placeholders.
const placeholders = JSON.parse(read("placeholder-assets.json").toString());
for (const [path, hash] of Object.entries(placeholders)) {
  if (!existsSync(join(app, path))) fail(`${path} is missing`);
  else if (createHash("sha256").update(read(path)).digest("hex") === hash)
    fail(`${path} is still the generated placeholder: use your game's own art (4.3)`);
}

// 2. Store screenshots of THIS game: at least 3, iPhone 6.9" (1320×2868) or 6.5" (1284×2778 / 1242×2688).
const SIZES = new Set(["1320x2868", "2868x1320", "1290x2796", "2796x1290", "1284x2778", "2778x1284", "1242x2688", "2688x1242"]);
const shotsDir = join(app, "store/screenshots");
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith(".png")) : [];
const sized = shots.filter((f) => {
  const png = readFileSync(join(shotsDir, f));
  return SIZES.has(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
});
if (sized.length < 3) fail(`store/screenshots/ has ${sized.length} iPhone 6.9"/6.5" PNGs; App Store Connect needs 3+ of your game, phone AND TV in play`);

// 3. Your Apple team, your production deploy.
const config = read("app.config.ts").toString();
if (/appleTeamId: ""/.test(config)) fail("app.config.ts: appleTeamId is empty (your own team, developer.apple.com → Membership)");
const deploysFile = join(app, "../deploys.json");
const deploys = existsSync(deploysFile) ? JSON.parse(readFileSync(deploysFile, "utf8")) : {};
if (!deploys.production) fail("no production deploy: run `pnpm run deploy` in the game's folder (APP_ENV=production builds open it)");

// 4. The review note is filled in.
const notes = read("REVIEW_NOTES.md").toString().split("---")[1] ?? "";
const blanks = notes.match(/\[[^\]]+\]/g) ?? [];
if (blanks.length > 0) fail(`REVIEW_NOTES.md still has ${blanks.length} [bracket] blanks, e.g. ${blanks[0]}`);

console.log(`Pre-submit checklist (also read it, it isn't all automatic):
  [ ] Submitting from your own Apple Developer account, as the game's owner (guideline 4.2.6)
  [ ] Unique name, icon, screenshots and game content: not the starter's kites (4.3)
  [ ] TestFlight build played end to end on a real iPhone and a TV (AirPlay and/or Chromecast)
  [ ] Privacy Nutrition Label filled in (OGS profile name/avatar/id, push token; no tracking)
`);
if (failures.length > 0) {
  console.error(`Not ready to submit:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}
console.log("Mechanical checks passed.");
