import type { ClientMessage, SessionState } from "@open-game-system/ogs-protocol";
import { type Browser, chromium, type Page } from "playwright";

declare global {
  interface Window {
    /** What a fake game page received from the launcher. */
    received?: { type: string }[];
  }
}

export const BASE = `http://localhost:${process.env.TV_E2E_PORT ?? 5190}`;
export const SHOTS = new URL("./__screens__/", import.meta.url).pathname;
export const ROCKET_TV = "https://rocket-crew.jonathanrmumm.workers.dev/tv?room=KITE";
export const BAKE_TV = "https://bake-shop.jonathanrmumm.workers.dev/tv?room=OVEN";
export const BROKEN_TV = "https://night-flight.jonathanrmumm.workers.dev/tv?room=LOST";

/**
 * A stand-in for a game's TV page on its own origin. `talks` makes it answer ogs:start with a resume
 * point (the way a game could); without it, it says nothing at all, like today's games.
 */
function gamePage(art: string, talks: boolean) {
  return `<!doctype html><html><body style="margin:0;background:#000;overflow:hidden">
<img src="${art}" style="position:fixed;inset:0;width:100%;height:100%;object-fit:cover">
<script>
window.received = [];
addEventListener("message", (e) => {
  window.received.push(e.data);
  ${talks ? `if (e.data && e.data.type === "ogs:start") parent.postMessage({ type: "ogs:resume-point", label: "Mission 6" }, "*");` : ""}
});
</script></body></html>`;
}

export async function launch(): Promise<Browser> {
  return chromium.launch();
}

/** Serves a fake game page on the game's own origin, with its art from the launcher's public dir. */
async function routeGame(page: Page, origin: string, art: string, talks: boolean) {
  await page.route(`${origin}/**`, async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.startsWith("/art/"))
      return r.fulfill({ response: await page.request.fetch(`${BASE}${path}`) });
    return r.fulfill({ contentType: "text/html", body: gamePage(art, talks) });
  });
}

export async function open(
  browser: Browser,
  query = "?fake=1",
  opts: {
    reducedMotion?: boolean;
    /** The page's CSS viewport; the cloud renderer draws the launcher at 1280×720 (deviceScaleFactor 1–2). */
    viewport?: { width: number; height: number };
    deviceScaleFactor?: number;
  } = {},
) {
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1920, height: 1080 },
    deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  await routeGame(
    page,
    "https://rocket-crew.jonathanrmumm.workers.dev",
    "/art/rocket-crew/launch.jpg",
    true,
  );
  await routeGame(
    page,
    "https://bake-shop.jonathanrmumm.workers.dev",
    "/art/bake-shop/bear.jpg",
    false,
  );
  // Never answers: a game page that fails to load.
  await page.route("https://night-flight.jonathanrmumm.workers.dev/**", () => {});
  await page.goto(`${BASE}/${query}`);
  return page;
}

export async function send(page: Page, msg: ClientMessage) {
  await page.evaluate((m) => window.__ogsFake?.send(m), msg);
}

export async function sessionState(page: Page): Promise<SessionState | null> {
  return page.evaluate(() => window.__ogsFake?.state() ?? null);
}

/** Let fonts, images and the cut-over settle before a screenshot. */
export async function settle(page: Page, ms = 800) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

export async function shot(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}${name}.png` });
}

/** Every visible text run on screen: its font size and box, for the 24 px and title-safe checks. */
export async function textRuns(page: Page) {
  return page.evaluate(() => {
    const out: { text: string; size: number; x: number; y: number; r: number; b: number }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (el.closest('[data-phase="hidden"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const box = range.getBoundingClientRect();
      // Clip to every ancestor that hides overflow: text scrolled out of a row is not on screen.
      let [x, y, r, b] = [box.left, box.top, box.right, box.bottom];
      for (let a: Element | null = el; a; a = a.parentElement) {
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
      out.push({ text, size: Number.parseFloat(style.fontSize), x, y, r, b });
    }
    return out;
  });
}

/** An attribute of the element with this test id, or null when it isn't there (never waits). */
export async function attr(page: Page, testId: string, name: string): Promise<string | null> {
  return page.evaluate(
    ({ id, n }) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute(n) ?? null,
    { id: testId, n: name },
  );
}

export async function count(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
}

/** The launcher messages a framed fake game has received, in order. */
export async function receivedBy(page: Page, testId: string): Promise<string[]> {
  return page
    .frameLocator(`[data-testid=${testId}]`)
    .locator("body")
    .evaluate(() => (window.received ?? []).map((m) => m.type));
}
