import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launch, open, RENDERER_AUTOPLAY, ROCKET_TV, send, sessionState } from "./harness";

/**
 * docs/acceptance/2026-10-04-launcher-theme.feature, in a real browser: which theme is playing
 * (the audio elements the launcher keeps in [data-testid=theme-audio]) as the ring moves, and
 * silence everywhere but Home.
 */
let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launch([RENDERER_AUTOPLAY]);
});
afterAll(async () => {
  await browser.close();
});

interface Track {
  src: string;
  paused: boolean;
  volume: number;
  time: number;
}

/** Every theme the launcher holds: its path, whether it is playing, its volume and position. */
async function tracks(p: Page = page): Promise<Track[]> {
  return p.evaluate(() =>
    [...document.querySelectorAll<HTMLAudioElement>("[data-testid=theme-audio] audio")].map(
      (a) => ({
        src: new URL(a.src).pathname,
        paused: a.paused,
        volume: a.volume,
        time: a.currentTime,
      }),
    ),
  );
}

/** The one theme that is playing at full theme volume, once fades have settled ("" = silence). */
async function playing(p: Page = page): Promise<string> {
  const ts = await tracks(p);
  if (ts.length === 0) return "";
  const on = ts.filter((t) => !t.paused);
  return on.length === 1 && ts.length === 1 && on[0]?.volume === 0.5 ? (on[0]?.src ?? "?") : "?";
}

const focused = () =>
  page.evaluate(() => document.querySelector("[data-focused]")?.getAttribute("data-item") ?? null);
const theme = (appId: string) => `/art/${appId}/theme.m4a`;
const poll = { timeout: 5000 };

describe("the launcher plays the focused game's theme on Home", () => {
  beforeAll(async () => {
    page = await open(browser);
    await page.getByTestId("home").waitFor();
    await page.locator('[data-focused][data-item="game:bake-shop"]').waitFor();
  });

  it("the focused game plays its theme, quietly, looped, and it really plays", async () => {
    await expect.poll(() => playing(), poll).toBe(theme("bake-shop"));
    const loop = await page.evaluate(
      () => document.querySelector<HTMLAudioElement>("[data-testid=theme-audio] audio")?.loop,
    );
    expect(loop).toBe(true);
    const at = (await tracks())[0]?.time ?? 0;
    await expect.poll(async () => (await tracks())[0]?.time ?? 0, poll).toBeGreaterThan(at + 0.3);
  });

  it("moving the ring crossfades to the next game's theme", async () => {
    await send(page, { type: "focus.move", dir: "right" });
    await expect.poll(focused).toBe("game:story-nook");
    // Mid-crossfade both are held: the old on its way out, the new on its way in.
    await expect
      .poll(async () => (await tracks()).map((t) => t.src).sort())
      .toEqual([theme("bake-shop"), theme("story-nook")].sort());
    await expect.poll(() => playing(), poll).toBe(theme("story-nook"));
  });

  it("a game without a theme is silence", async () => {
    await send(page, { type: "focus.set", itemId: "game:hearthisle" });
    await expect.poll(focused).toBe("game:hearthisle");
    await expect.poll(() => playing(), poll).toBe("");
  });

  it("a sitting card plays its game's theme; Surprise me is silence", async () => {
    await send(page, { type: "focus.set", itemId: "game:bake-shop" });
    await expect.poll(() => playing(), poll).toBe(theme("bake-shop"));
    await send(page, { type: "focus.move", dir: "down" });
    await expect.poll(focused).toMatch(/^play:bake-shop:/);
    await expect.poll(() => playing(), poll).toBe(theme("bake-shop"));
    const surprise = await page.locator('[data-card="surprise"]').getAttribute("data-item");
    await send(page, { type: "focus.set", itemId: surprise ?? "" });
    await expect.poll(focused).toBe(surprise);
    await expect.poll(() => playing(), poll).toBe("");
  });

  it("a game's page is silence, and back on Home the theme returns", async () => {
    await send(page, { type: "focus.set", itemId: "game:rocket-crew" });
    await expect.poll(() => playing(), poll).toBe(theme("rocket-crew"));
    await send(page, { type: "select", deviceId: "jonathan-phone" });
    await page.getByTestId("game-page").waitFor();
    await expect.poll(() => playing(), poll).toBe("");
    await send(page, { type: "back" });
    await page.getByTestId("game-page").waitFor({ state: "detached" });
    await expect.poll(() => playing(), poll).toBe(theme("rocket-crew"));
  });

  it("starting a game fades the theme out: silent while Getting ready and while it runs", async () => {
    await expect.poll(() => playing(), poll).toBe(theme("rocket-crew"));
    await send(page, { type: "game.start", appId: "rocket-crew", mode: "new" });
    await page.getByTestId("starting").waitFor();
    // A fade, not a cut: right after the start the theme is still on its way out.
    await expect
      .poll(async () => {
        const [t, ...more] = await tracks();
        return t && more.length === 0 && t.src === theme("rocket-crew") && !t.paused
          ? t.volume > 0 && t.volume < 0.5
          : false;
      })
      .toBe(true);
    await expect.poll(() => playing(), poll).toBe("");
    await send(page, { type: "game.view", appId: "rocket-crew", url: ROCKET_TV });
    await expect.poll(async () => (await sessionState(page))?.current?.viewUrl).toBe(ROCKET_TV);
    await page.waitForTimeout(800);
    expect(await playing()).toBe("");
  });

  it("back Home from a running game, the focused game's theme plays again", async () => {
    await send(page, { type: "home" });
    await page.getByTestId("home").waitFor();
    await expect.poll(async () => (await sessionState(page))?.screen).toBe("home");
    const f = await focused();
    const appId = f?.startsWith("game:") ? f.slice(5) : f?.split(":")[1];
    await expect.poll(() => playing(), poll).toBe(theme(appId ?? ""));
  });
});

describe("a browser that blocks autoplay", () => {
  it("stays silent without an error, and starts the theme on the next key press", async () => {
    // A plain browser's policy, made certain: play() refuses until the page has had a key press.
    const blocked = await open(browser, "?fake=1", {
      init: () => {
        let gesture = false;
        addEventListener("keydown", () => (gesture = true), { capture: true });
        const play = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
          return gesture
            ? play.call(this)
            : Promise.reject(new DOMException("play() needs a user gesture", "NotAllowedError"));
        };
      },
    });
    const errors: string[] = [];
    blocked.on("pageerror", (e) => errors.push(e.message));
    await blocked.getByTestId("home").waitFor();
    await expect
      .poll(async () => (await tracks(blocked)).map((t) => [t.src, t.paused]))
      .toEqual([[theme("bake-shop"), true]]);
    await blocked.waitForTimeout(800);
    expect(await playing(blocked)).toBe("?");
    // Shift moves nothing on the launcher: only the retry runs.
    await blocked.keyboard.press("Shift");
    await expect.poll(() => playing(blocked), poll).toBe(theme("bake-shop"));
    expect(errors).toEqual([]);
    await blocked.context().close();
  });
});
