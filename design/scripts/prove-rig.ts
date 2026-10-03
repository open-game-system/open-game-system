// pnpm prove-rig — feeds every check a deliberate fault (the _smoke concept) and fails unless each
// one is caught, plus a wrong scenario that must fail the acknowledgement. Run before a round when
// the rig changed; a check that stops catching its fault is a blind rig, not a passing design.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { buildAndServe, ROOT, waitForAck } from "./lib";

const out = join(ROOT, ".cache", "prove-rig");
execFileSync("pnpm", ["-s", "shoot", "--concept", "_smoke", "--out", out], { cwd: ROOT, stdio: "inherit" });
const raw: unknown = JSON.parse(readFileSync(join(out, "_smoke", "checks.json"), "utf8"));
const summary = typeof raw === "object" && raw !== null && "summary" in raw && typeof raw.summary === "object" && raw.summary !== null ? raw.summary : {};
const count = (k: string): number => {
  const v: unknown = Object.entries(summary).find(([key]) => key === k)?.[1];
  return typeof v === "number" ? v : 0;
};
const expectations = ["targetsUnder44", "contrastFails", "kidWords", "tvSmallText", "clippedText"];
const failures = expectations.filter((k) => count(k) === 0).map((k) => `${k} missed its fault`);

const { base, server } = await buildAndServe(`prove-${process.pid}`, ["_smoke"]);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${base}?concept=_smoke&scenario=no-such-scenario&device=phone&shot=1`);
  let caught = false;
  try {
    await waitForAck(page, "_smoke/no-such-scenario/phone");
  } catch {
    caught = true;
  }
  if (!caught) failures.push("unknown scenario was acknowledged");
  await page.goto(`${base}?concept=_smoke&scenario=swap.01-bake&device=phone&shot=1`);
  caught = false;
  try {
    await waitForAck(page, "_smoke/home.01-rocket/phone");
  } catch {
    caught = true;
  }
  if (!caught) failures.push("mislabelled scenario passed the acknowledgement");
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.error(`RIG BLIND:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`rig proven: ${expectations.map((k) => `${k}=${count(k)}`).join(" ")}, ack mismatch caught`);
