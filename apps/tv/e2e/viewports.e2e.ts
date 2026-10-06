import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launch, open, SHOTS, send, settle } from "./harness";

/**
 * The launcher fits any 16:9 screen. The cloud renderer draws it at 1280×720 CSS px
 * (services/api/container STREAM_VIEWPORT, deviceScaleFactor 1–2), a desktop Cast at 1920×1080,
 * a 4K browser at 3840×2160. On every one, every visible launcher element sits inside the TV-safe
 * area (5% in from each edge, for overscan); only full-bleed backdrops reach the edges.
 */
const SIZES = [
  { name: "720p", width: 1280, height: 720, dsf: 1 },
  { name: "720p-renderer-dsf2", width: 1280, height: 720, dsf: 2 },
  { name: "1080p", width: 1920, height: 1080, dsf: 1 },
  { name: "4k", width: 3840, height: 2160, dsf: 1 },
];

let browser: Browser;

beforeAll(async () => {
  browser = await launch();
});
afterAll(async () => {
  await browser.close();
});

/** The stage's box on screen: the launcher's whole picture. */
function stageBox(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector(".stage")?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, r: r.right, b: r.bottom } : null;
  });
}

/**
 * Every visible launcher element whose on-screen box (clipped to ancestors that hide overflow)
 * leaves the 5% safe area. Full-bleed backdrops (a box covering the whole stage) are exempt.
 */
function outsideSafeArea(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".stage");
    if (!stage) return ["no .stage"];
    const s = stage.getBoundingClientRect();
    const [W, H] = [innerWidth, innerHeight];
    const safe = { x: W * 0.05 - 1, y: H * 0.05 - 1, r: W * 0.95 + 1, b: H * 0.95 + 1 };
    const out: string[] = [];
    for (const el of stage.querySelectorAll("*")) {
      if (el.closest('[data-phase="hidden"]')) continue;
      let shown = true;
      for (let a: Element | null = el; a && a !== stage; a = a.parentElement) {
        const st = getComputedStyle(a);
        if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0)
          shown = false;
      }
      if (!shown) continue;
      const box = el.getBoundingClientRect();
      if (
        box.left <= s.left + 1 &&
        box.top <= s.top + 1 &&
        box.right >= s.right - 1 &&
        box.bottom >= s.bottom - 1
      )
        continue;
      let [x, y, r, b] = [box.left, box.top, box.right, box.bottom];
      for (let a = el.parentElement; a && a !== stage; a = a.parentElement) {
        if (getComputedStyle(a).overflow === "visible") continue;
        const c = a.getBoundingClientRect();
        [x, y, r, b] = [
          Math.max(x, c.left),
          Math.max(y, c.top),
          Math.min(r, c.right),
          Math.min(b, c.bottom),
        ];
      }
      if (r - x < 1 || b - y < 1) continue;
      if (x < safe.x || y < safe.y || r > safe.r || b > safe.b) {
        const id = el.getAttribute("data-testid") ?? el.getAttribute("data-item") ?? "";
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.className)} ${id} [${[x, y, r, b].map(Math.round)}]`,
        );
      }
    }
    return out;
  });
}

async function expectFits(page: Page, size: (typeof SIZES)[number], screen: string) {
  await settle(page, 1200);
  await page.screenshot({ path: `${SHOTS}viewport-${size.name}-${screen}.png` });
  // The stage fills the 16:9 screen exactly: no offset, nothing running off an edge.
  const stage = await stageBox(page);
  expect(stage).not.toBeNull();
  expect(Math.abs((stage?.x ?? -1) - 0)).toBeLessThan(1);
  expect(Math.abs((stage?.y ?? -1) - 0)).toBeLessThan(1);
  expect(Math.abs((stage?.r ?? -1) - size.width)).toBeLessThan(1);
  expect(Math.abs((stage?.b ?? -1) - size.height)).toBeLessThan(1);
  expect(await outsideSafeArea(page), `${screen} at ${size.name}`).toEqual([]);
}

describe.each(SIZES)("launcher at $name ($width×$height, dsf $dsf)", (size) => {
  it("Home, Rocket Crew's page and Getting ready stay inside the TV-safe area", async () => {
    const page = await open(browser, "?fake=1", {
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.dsf,
    });
    try {
      await page.getByTestId("home").waitFor();
      await send(page, { type: "focus.set", itemId: "game:rocket-crew" });
      await expect
        .poll(() =>
          page.evaluate(() => document.querySelector("[data-focused]")?.getAttribute("data-item")),
        )
        .toBe("game:rocket-crew");
      await expectFits(page, size, "home");

      await send(page, { type: "select", deviceId: "jonathan-phone" });
      await page.getByTestId("game-page").waitFor();
      await expectFits(page, size, "game-page");

      await send(page, { type: "select", deviceId: "jonathan-phone" });
      await page.getByTestId("starting").waitFor();
      await expectFits(page, size, "starting");
    } finally {
      await page.context().close();
    }
  });
});
