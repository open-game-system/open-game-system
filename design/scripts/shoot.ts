// pnpm shoot [--concept a,b] [--only <scenario-prefix>] [--out <dir>]
// Every scenario × device at true CSS size (labelled by scenario id), plus automatic checks:
// tap targets ≥ 44 pt, WCAG AA contrast against the pixels actually behind the text, clipped or
// off-screen text, words on kid surfaces (want 0), TV text ≥ 24 px (3 m), and taps per flow.
import { chromium, type Page } from "playwright";
import { PNG } from "pngjs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { arg, buildAndServe, readRegistry, ROOT, settle, waitForAck, type ConceptMeta } from "./lib";

type Device = "phone" | "ipad" | "tv";
const SIZE: Record<Device, { width: number; height: number; dsf: number }> = {
  phone: { width: 390, height: 844, dsf: 2 },
  ipad: { width: 820, height: 1180, dsf: 2 },
  tv: { width: 1920, height: 1080, dsf: 1 },
};

/** Thresholds. Changing one is a decision: log old → new and why in the scorecard. */
export const THRESHOLDS = { minTarget: 44, contrastBody: 4.5, contrastLarge: 3, tvMinText: 24 };

interface TextBox { text: string; x: number; y: number; w: number; h: number; color: string; size: number; weight: number; grownup: boolean; clipped: boolean }
interface TargetBox { label: string; w: number; h: number; x: number; y: number }
interface Probe { texts: TextBox[]; targets: TargetBox[] }

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-ogs-root]");
    if (!root) return { texts: [], targets: [] };
    const rb = root.getBoundingClientRect();
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      for (let p: Element | null = el; p && p !== root; p = p.parentElement) {
        if (Number(getComputedStyle(p).opacity) === 0) return false;
      }
      return r.right > rb.left && r.bottom > rb.top && r.left < rb.right && r.top < rb.bottom;
    };
    const texts: TextBox[] = [];
    // Scrolling content may extend past a scroll container's edge: that's not clipping.
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (/(auto|scroll)/.test(o.overflowY + o.overflowX)) return true;
      }
      return false;
    };
    // Text under a modal scrim, sheet or banner is covered, not low-contrast: skip it.
    const covered = (el: Element, r: DOMRect) => {
      if (el.closest("[inert], [aria-hidden=true]")) return true;
      const cx = Math.min(Math.max(r.left + r.width / 2, rb.left + 1), rb.right - 1);
      const cy = Math.min(Math.max(r.top + r.height / 2, rb.top + 1), rb.bottom - 1);
      const top = document.elementFromPoint(cx, cy);
      return !!top && top !== el && !el.contains(top) && !top.contains(el);
    };
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
      const own = nodes.map((n) => n.textContent ?? "").join("").trim();
      if (!own || !visible(el)) continue;
      // Measure the text's own box (not the button around it), so the ring samples what the glyphs sit on.
      const range = document.createRange();
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first || !last) continue;
      range.setStartBefore(first);
      range.setEndAfter(last);
      const r = range.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || covered(el, r)) continue;
      const cs = getComputedStyle(el);
      const clipped = (cs.overflow !== "visible" || cs.textOverflow === "ellipsis") && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2);
      const offscreen = !inScroller(el) && (r.left < rb.left - 1 || r.right > rb.right + 1 || r.top < rb.top - 1 || r.bottom > rb.bottom + 1);
      texts.push({
        text: own.slice(0, 60), x: r.left - rb.left, y: r.top - rb.top, w: r.width, h: r.height,
        color: cs.color, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400,
        grownup: !!el.closest("[data-grownup]"), clipped: clipped || offscreen,
      });
    }
    const targets: TargetBox[] = [];
    for (const el of root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [role=button], [data-bot]")) {
      if (!visible(el) || el.closest("[aria-hidden=true]")) continue;
      const r = el.getBoundingClientRect();
      targets.push({ label: (el.dataset.bot ?? el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40), w: r.width, h: r.height, x: r.left - rb.left, y: r.top - rb.top });
    }
    return { texts, targets };
  });
}

function parseColor(c: string): [number, number, number, number] {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m?.[1]) return [0, 0, 0, 1];
  const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}
const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Median colour of a ring just outside the text box: the pixels the text actually sits on. */
function backgroundAt(png: PNG, t: TextBox, dsf: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const pad = 3;
  const x0 = Math.max(0, Math.floor((t.x - pad) * dsf)), x1 = Math.min(png.width - 1, Math.ceil((t.x + t.w + pad) * dsf));
  const y0 = Math.max(0, Math.floor((t.y - pad) * dsf)), y1 = Math.min(png.height - 1, Math.ceil((t.y + t.h + pad) * dsf));
  const push = (x: number, y: number) => {
    const i = (y * png.width + x) * 4;
    rs.push(png.data[i] ?? 0); gs.push(png.data[i + 1] ?? 0); bs.push(png.data[i + 2] ?? 0);
  };
  for (let x = x0; x <= x1; x += 2) { push(x, y0); push(x, y1); }
  for (let y = y0; y <= y1; y += 2) { push(x0, y); push(x1, y); }
  const med = (a: number[]) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)] ?? 0;
  return [med(rs), med(gs), med(bs)];
}

async function main() {
  const only = arg("only");
  const wanted = arg("concept")?.split(",");
  const outRoot = arg("out") ?? join(ROOT, "critic", "shots");
  const { base, server } = await buildAndServe(`shoot-${process.pid}`, wanted);
  const browser = await chromium.launch();
  try {
    const probePage = await browser.newPage();
    const registry = (await readRegistry(probePage, base)).filter((c) => (wanted ? wanted.includes(c.id) : !c.id.startsWith("_")));
    await probePage.close();
    if (registry.length === 0) throw new Error("no concepts matched");
    for (const concept of registry) await shootConcept(concept, browser, base, join(outRoot, concept.id), only);
  } finally {
    await browser.close();
    server.close();
  }
}

async function shootConcept(concept: ConceptMeta, browser: import("playwright").Browser, base: string, out: string, only?: string) {
  await mkdir(join(out, "shots"), { recursive: true });
  const shots: unknown[] = [];
  const summary = { shots: 0, targetsUnder44: 0, contrastFails: 0, kidWords: 0, tvSmallText: 0, clippedText: 0, ackFailures: 0 };
  const contexts = new Map<Device, Page>();
  const devices: Device[] = ["phone", "ipad", "tv"];
  for (const d of devices) {
    const ctx = await browser.newContext({ viewport: { width: SIZE[d].width, height: SIZE[d].height }, deviceScaleFactor: SIZE[d].dsf, hasTouch: d !== "tv" });
    // tsx (esbuild keepNames) wraps functions in __name(); page.evaluate bodies need it defined.
    await ctx.addInitScript({ content: "window.__name = (f) => f;" });
    contexts.set(d, await ctx.newPage());
  }
  for (const sc of concept.scenarios) {
    if (only && !sc.id.startsWith(only)) continue;
    for (const device of sc.devices) {
      const page = contexts.get(device);
      if (!page) continue;
      const name = `${sc.id}--${device}`;
      try {
        await page.goto(`${base}?concept=${concept.id}&scenario=${encodeURIComponent(sc.id)}&device=${device}&shot=1`);
        await waitForAck(page, `${concept.id}/${sc.id}/${device}`);
        await settle(page);
      } catch (e) {
        summary.ackFailures++;
        shots.push({ name, error: String(e) });
        console.error(`ACK FAIL ${name}: ${e}`);
        continue;
      }
      const buf = await page.screenshot({ type: "png" });
      await page.screenshot({ path: join(out, "shots", `${name}.jpg`), type: "jpeg", quality: 88 });
      const png = PNG.sync.read(buf);
      const { texts, targets } = await probe(page);
      const dsf = SIZE[device].dsf;
      const contrastFails = texts.flatMap((t) => {
        const [r, g, b, a] = parseColor(t.color);
        const bg = backgroundAt(png, t, dsf);
        const mix = (c: number, k: number) => c * a + k * (1 - a);
        const cr = ratio(lum(mix(r, bg[0]), mix(g, bg[1]), mix(b, bg[2])), lum(bg[0], bg[1], bg[2]));
        const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
        const need = large ? THRESHOLDS.contrastLarge : THRESHOLDS.contrastBody;
        return cr < need ? [{ text: t.text, ratio: Math.round(cr * 100) / 100, need, size: t.size }] : [];
      });
      const small = device === "tv" ? [] : targets.filter((t) => t.w < THRESHOLDS.minTarget - 0.5 || t.h < THRESHOLDS.minTarget - 0.5);
      const kidWords = device === "ipad" ? texts.filter((t) => !t.grownup && /\p{L}/u.test(t.text)).map((t) => t.text) : [];
      const tvSmall = device === "tv" ? texts.filter((t) => t.size < THRESHOLDS.tvMinText).map((t) => ({ text: t.text, size: t.size })) : [];
      const clipped = texts.filter((t) => t.clipped).map((t) => t.text);
      summary.shots++;
      summary.targetsUnder44 += small.length;
      summary.contrastFails += contrastFails.length;
      summary.kidWords += kidWords.length;
      summary.tvSmallText += tvSmall.length;
      summary.clippedText += clipped.length;
      shots.push({ name, scenario: sc.id, label: sc.label, flow: sc.flow, state: sc.state, device, targetsUnder44: small, contrastFails, kidWords, tvSmallText: tvSmall, clippedText: clipped });
      process.stdout.write(".");
    }
  }
  const taps = concept.flows.map((f) => ({ flow: f.id, label: f.label, taps: f.steps.filter((s) => s.device !== "tv").length, perDevice: countBy(f.steps.map((s) => s.device)) }));
  const checks = { concept: concept.id, thresholds: THRESHOLDS, summary, tapsPerFlow: taps, shots };
  await writeFile(join(out, "checks.json"), JSON.stringify(checks, null, 2));
  await writeFile(join(out, "scenarios.json"), JSON.stringify(concept.scenarios, null, 2));
  execFileSync("python3", [join(ROOT, "scripts", "sheet.py"), out], { stdio: "inherit" });
  execFileSync("python3", [join(ROOT, "scripts", "coverage.py"), out], { stdio: "inherit" });
  console.log(`\n${concept.id}: ${JSON.stringify(summary)}`);
}

function countBy(xs: string[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of xs) o[x] = (o[x] ?? 0) + 1;
  return o;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
