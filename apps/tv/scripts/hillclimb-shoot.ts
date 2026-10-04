/**
 * Design hill-climb evidence rig: one command per round.
 *   TV_E2E_PORT=5189 node scripts/hillclimb-shoot.ts <round>   (from apps/tv)
 * Builds the launcher, serves it with `vite preview` on 5189, and writes to
 * docs/hillclimb-2026-10-04/<round>/: one 1920×1080 shot per scenario, a labelled contact sheet,
 * a recording of the focus moving across the home screen (focus.mp4) and a frame strip of it.
 * Every scenario must acknowledge (its selector appears) or the round fails: no silent defaults.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import { build, preview } from "vite";
import { BROKEN_TV, launch, open, ROCKET_TV, send, settle, textRuns } from "../e2e/harness.ts";

const round = process.argv[2];
if (!round) throw new Error("usage: hillclimb-shoot.ts <round>");
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "docs/hillclimb-2026-10-04", round);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.TV_E2E_PORT ?? 5189);

await build({ root: ROOT, logLevel: "warn" });
const server = await preview({
  root: ROOT,
  preview: { port: PORT, strictPort: true },
  logLevel: "warn",
});

const browser = await launch();
const press = async (page: Page, dir: "up" | "down" | "left" | "right", n = 1) => {
  for (let i = 0; i < n; i++) {
    await send(page, { type: "focus.move", dir });
    await page.waitForTimeout(120);
  }
};
const select = (page: Page) => send(page, { type: "select", deviceId: "jonathan-phone" });

interface Scenario {
  id: string;
  label: string;
  query?: string;
  /** Drives the fake session; returns the selector that proves the scenario rendered. */
  run(page: Page): Promise<string>;
  optional?: boolean;
}

const scenarios: Scenario[] = [
  {
    id: "01-connecting",
    label: "Connecting (before the session)",
    query: "?fake=1&hold=1",
    run: async () => "[data-testid=assembling]",
  },
  {
    id: "02-home-fresh",
    label: "Home · fresh evening, nothing played",
    query: "?fake=1&world=fresh",
    run: async () => "[data-testid=home]",
  },
  {
    id: "03-home-evening",
    label: "Home · evening with sittings (first focus)",
    run: async () => "[data-testid=home]",
  },
  {
    id: "04-home-focus-right2",
    label: "Home · focus moved right ×2",
    run: async (p) => {
      await press(p, "right", 2);
      return "[data-focused]";
    },
  },
  {
    id: "05-home-focus-down",
    label: "Home · focus moved down ×1",
    run: async (p) => {
      await press(p, "down");
      return "[data-focused]";
    },
  },
  {
    id: "06-home-focus-down-right",
    label: "Home · focus down, then right ×2",
    run: async (p) => {
      await press(p, "down");
      await press(p, "right", 2);
      return "[data-focused]";
    },
  },
  {
    id: "07-game-page-paused",
    label: "Game page · paused game (Bake Shop, Day 4)",
    run: async (p) => {
      await send(p, { type: "focus.set", itemId: "game:bake-shop" });
      await select(p);
      return "[data-testid=game-page]";
    },
  },
  {
    id: "08-game-page-start",
    label: "Game page · paused game, remote pressed right",
    run: async (p) => {
      await send(p, { type: "focus.set", itemId: "game:bake-shop" });
      await select(p);
      await p.getByTestId("game-page").waitFor();
      await press(p, "right");
      return "[data-testid=game-page]";
    },
  },
  {
    id: "09-game-page-new",
    label: "Game page · never played (Night Flight)",
    run: async (p) => {
      await send(p, { type: "focus.set", itemId: "game:night-flight" });
      await select(p);
      return "[data-testid=game-page]";
    },
  },
  {
    id: "10-starting",
    label: "Getting ready (game starting on the phone)",
    run: async (p) => {
      await send(p, { type: "game.start", appId: "rocket-crew", mode: "new" });
      return "[data-testid=starting]";
    },
  },
  {
    id: "11-cutover-grow",
    label: "Cut-over · box growing to full screen (frozen at 300 ms)",
    run: async (p) => {
      await send(p, { type: "focus.set", itemId: "game:rocket-crew" });
      await settle(p, 600);
      await send(p, { type: "game.start", appId: "rocket-crew", mode: "new" });
      // Everything that moves with the cut-over (the box, its picture, the room behind) is frozen
      // at the same instant, so the shot is a real frame of the motion.
      await p.evaluate(() => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = 300;
        }
      });
      return "[data-testid=player]";
    },
  },
  {
    id: "12-framed",
    label: "Framed game (the game's own TV page)",
    run: async (p) => {
      await send(p, { type: "game.start", appId: "rocket-crew", mode: "new" });
      await send(p, { type: "game.view", appId: "rocket-crew", url: ROCKET_TV });
      return "[data-testid=game-frame].live";
    },
  },
  {
    id: "13-home-after-play",
    label: "Home after a game (Home pressed: Rocket Crew paused just now)",
    run: async (p) => {
      await send(p, { type: "game.start", appId: "rocket-crew", mode: "new" });
      await send(p, { type: "game.view", appId: "rocket-crew", url: ROCKET_TV });
      await p.locator("[data-testid=game-frame].live").waitFor();
      await p.waitForTimeout(600);
      await send(p, { type: "home" });
      await p.locator('[data-testid=player][data-phase="hidden"]').waitFor({ state: "attached" });
      return "[data-testid=home]";
    },
  },
  {
    id: "14-frame-failed",
    label: "A game's TV page never loads",
    query: "?fake=1&frameTimeout=1200",
    run: async (p) => {
      await send(p, { type: "game.start", appId: "night-flight", mode: "new" });
      await send(p, { type: "game.view", appId: "night-flight", url: BROKEN_TV });
      await p.getByTestId("frame-failed").waitFor({ timeout: 5000 });
      return "[data-testid=frame-failed]";
    },
  },
  {
    id: "15-reconnecting",
    label: "Reconnecting to the phones (socket dropped)",
    run: async (p) => {
      await p.evaluate(() => window.__ogsFake?.drop());
      return "[data-testid=reconnecting]";
    },
  },
  {
    id: "16-surprise",
    label: "Surprise me · picked (OK pressed on the Surprise card)",
    optional: true,
    run: async (p) => {
      const item = await p.locator('[data-card="surprise"]').getAttribute("data-item");
      if (!item) return "";
      await send(p, { type: "focus.set", itemId: item });
      await p.waitForTimeout(500);
      await select(p);
      await p.waitForTimeout(900);
      return "[data-testid=surprise]";
    },
  },
];

const shots: { id: string; label: string }[] = [];
const checks: { id: string; textRuns: number; under24px: string[]; outsideTitleSafe: string[] }[] =
  [];
for (const sc of scenarios) {
  const page = await open(browser, sc.query ?? "?fake=1");
  await page.locator("[data-testid=home], [data-testid=assembling]").first().waitFor();
  await settle(page, 400);
  const sel = await sc.run(page);
  if (!sel) {
    if (!sc.optional) throw new Error(`${sc.id}: no selector`);
    console.log(`skip ${sc.id} (not in this design)`);
    await page.context().close();
    continue;
  }
  await page.locator(sel).first().waitFor({ state: "attached", timeout: 5000 });
  if (sc.id !== "11-cutover-grow") await settle(page, 900);
  else await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `${sc.id}.jpg`), type: "jpeg", quality: 85 });
  shots.push({ id: sc.id, label: sc.label });
  if (sc.id !== "11-cutover-grow" && sc.id !== "12-framed") {
    const runs = await textRuns(page);
    checks.push({
      id: sc.id,
      textRuns: runs.length,
      under24px: runs.filter((t) => t.size < 24).map((t) => t.text),
      outsideTitleSafe: runs
        .filter((t) => t.x < 95 || t.r > 1825 || t.y < 53 || t.b > 1027)
        .map((t) => t.text),
    });
  }
  console.log(`shot ${sc.id}`);
  await page.context().close();
}

writeFileSync(join(OUT, "checks.json"), `${JSON.stringify(checks, null, 2)}\n`);

// The focus moving across the home screen, recorded (cause → effect at remote speed).
{
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/?fake=1`);
  await page.getByTestId("home").waitFor();
  await settle(page, 1200);
  const firstMove = (Date.now() - t0) / 1000;
  for (const dir of ["right", "right", "right", "right", "right", "down", "right", "up"] as const) {
    await send(page, { type: "focus.move", dir });
    await page.waitForTimeout(900);
  }
  await context.close();
  const webm = readdirSync(OUT).find((f) => f.endsWith(".webm"));
  if (webm) {
    renameSync(join(OUT, webm), join(OUT, "focus.webm"));
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      join(OUT, "focus.webm"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      join(OUT, "focus.mp4"),
    ]);
    // From just before the first press: 2.5 frames a second for 8 s, a 5×4 strip.
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-ss",
      String(Math.max(0, firstMove - 0.4)),
      "-i",
      join(OUT, "focus.mp4"),
      "-vf",
      "fps=2.5,scale=480:-1,tile=5x4:padding=6:color=0x111111",
      "-frames:v",
      "1",
      join(OUT, "focus-strip.jpg"),
    ]);
    rmSync(join(OUT, "focus.webm"));
  }
}

// The contact sheet: every scenario, labelled, at 640×360.
{
  const page = await browser.newPage({ viewport: { width: 2000, height: 800 } });
  const cells = shots
    .map(
      (s) =>
        `<figure><img src="file://${join(OUT, `${s.id}.jpg`)}"><figcaption>${s.id} · ${s.label}</figcaption></figure>`,
    )
    .join("");
  const html = `<html><body style="margin:0;background:#111;font:600 15px system-ui;color:#eee">
  <h1 style="font:700 22px system-ui;margin:14px 18px">OGS TV launcher · round ${round} · 1920×1080 fake session</h1>
  <div style="display:grid;grid-template-columns:repeat(3,640px);gap:18px 20px;padding:0 18px 18px">${cells}</div>
  <style>figure{margin:0}img{width:640px;height:360px;display:block;border-radius:4px}figcaption{margin-top:6px}</style></body></html>`;
  writeFileSync(join(OUT, "sheet.html"), html);
  await page.goto(`file://${join(OUT, "sheet.html")}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(OUT, "sheet.jpg"),
    fullPage: true,
    type: "jpeg",
    quality: 85,
  });
  rmSync(join(OUT, "sheet.html"));
}

await browser.close();
await new Promise<void>((r) => server.httpServer.close(() => r()));
console.log(`round ${round}: ${shots.length} shots → ${OUT}`);
