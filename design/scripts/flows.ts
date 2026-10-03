// pnpm flows [--concept a,b] [--flow <id>] [--out <dir>]
// Plays each flow on the stage (TV | phone | iPad side by side, one shared session) like a family:
// taps the real elements (data-bot) on the right device, captions each beat, records video.
import { chromium } from "playwright";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { arg, buildAndServe, readRegistry, ROOT, settle, waitForAck } from "./lib";

const VIEWPORT = { width: 2240, height: 900 };

async function main() {
  const wanted = arg("concept")?.split(",");
  const onlyFlow = arg("flow");
  const outRoot = arg("out") ?? join(ROOT, "critic", "shots");
  const { base, server } = await buildAndServe(`flows-${process.pid}`, wanted);
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage();
    const registry = (await readRegistry(p, base)).filter((c) => (wanted ? wanted.includes(c.id) : !c.id.startsWith("_")));
    await p.close();
    for (const concept of registry) {
      const out = join(outRoot, concept.id, "flows");
      await mkdir(out, { recursive: true });
      const allMarks: Record<string, unknown> = {};
      for (const flow of concept.flows) {
        if (onlyFlow && flow.id !== onlyFlow) continue;
        const tmp = join(ROOT, ".cache", `video-${process.pid}-${flow.id}`);
        await rm(tmp, { recursive: true, force: true });
        const ctx = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: tmp, size: VIEWPORT } });
        await ctx.addInitScript({ content: "window.__name = (f) => f;" });
        const page = await ctx.newPage();
        const t0 = Date.now();
        const marks: { t: number; text: string; device?: string; bot?: string; stuck?: boolean }[] = [];
        const mark = async (text: string, extra: Partial<(typeof marks)[number]> = {}) => {
          marks.push({ t: (Date.now() - t0) / 1000, text, ...extra });
          await page.evaluate((m) => window.__ogsMark?.(m), text);
        };
        try {
          await page.goto(`${base}?concept=${concept.id}&scenario=${encodeURIComponent(flow.start)}&device=stage&flow=${flow.id}`);
          await waitForAck(page, `${concept.id}/${flow.start}/stage`);
          await settle(page);
          await mark(flow.label);
          await page.waitForTimeout(1500);
          for (const step of flow.steps) {
            const loc = page.locator(`[data-device="${step.device}"] [data-bot="${step.bot}"]`).first();
            if ((await loc.count()) === 0) {
              await mark(`STUCK: no "${step.bot}" on ${step.device}`, { device: step.device, bot: step.bot, stuck: true });
              console.error(`  ${concept.id}/${flow.id}: missing data-bot="${step.bot}" on ${step.device}`);
              await page.waitForTimeout(1500);
              break;
            }
            if (step.mark) await mark(step.mark, { device: step.device, bot: step.bot });
            await page.waitForTimeout(500);
            await loc.click({ timeout: 3000 });
            await page.waitForTimeout(step.wait ?? 1400);
          }
          await page.waitForTimeout(1200);
        } catch (e) {
          await mark(`ERROR: ${String(e).slice(0, 120)}`, { stuck: true });
          console.error(`  ${concept.id}/${flow.id}: ${e}`);
        }
        await ctx.close();
        const files = await readdir(tmp);
        const webm = files.find((f) => f.endsWith(".webm"));
        if (webm) {
          const mp4 = join(out, `${flow.id}.mp4`);
          execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(tmp, webm), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "veryfast", "-movflags", "+faststart", mp4]);
          await rename(join(tmp, webm), join(ROOT, ".cache", `${concept.id}-${flow.id}.webm`)).catch(() => undefined);
        }
        await rm(tmp, { recursive: true, force: true });
        allMarks[flow.id] = { label: flow.label, taps: flow.steps.filter((s) => s.device !== "tv").length, marks };
        console.log(`${concept.id}/${flow.id}: ${marks.length} marks, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      }
      await writeFile(join(out, "marks.json"), JSON.stringify(allMarks, null, 2));
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
