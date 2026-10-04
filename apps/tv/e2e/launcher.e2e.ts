import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attr,
  BAKE_TV,
  BROKEN_TV,
  count,
  launch,
  open,
  ROCKET_TV,
  receivedBy,
  SHOTS,
  send,
  sessionState,
  settle,
  shot,
  textRuns,
} from "./harness";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launch();
});
afterAll(async () => {
  await browser.close();
});

const bootId = () => page.evaluate(() => window.__launcherBootId);
const focused = () =>
  page.evaluate(() => document.querySelector("[data-focused]")?.getAttribute("data-item") ?? null);

async function expectTvRules() {
  const runs = await textRuns(page);
  expect(runs.length).toBeGreaterThan(0);
  const small = runs.filter((t) => t.size < 24);
  expect(small, `text under 24 px: ${JSON.stringify(small)}`).toEqual([]);
  const unsafe = runs.filter(
    (t) => t.x < 96 - 1 || t.r > 1824 + 1 || t.y < 54 - 1 || t.b > 1026 + 1,
  );
  expect(unsafe, `text outside title-safe: ${JSON.stringify(unsafe)}`).toEqual([]);
}

describe("TV launcher (fake session)", () => {
  beforeEach(async () => {
    page = await open(browser);
    await page.getByTestId("home").waitFor();
  });

  it("renders home: hero, Continue · Tonight · Library rows, the couch and the remote", async () => {
    await expect.poll(focused).toBe("game:bake-shop");
    const rows = await page
      .locator("[data-row]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-row")));
    expect(rows).toEqual(["continue", "tonight", "library"]);
    expect(await page.locator('[data-row="continue"] [data-item]').count()).toBe(2);
    expect(await page.locator('[data-item="game:bake-shop"]').textContent()).toContain("Day 4");
    const sitters = await page.locator("[data-testid=couch] figcaption").allTextContents();
    expect(sitters).toEqual(["Jonathan", "Mom", "Juneau", "Ava"]);
    expect(await page.getByTestId("remote-chip").textContent()).toContain(
      "Jonathan has the remote",
    );
    expect(await page.getByTestId("hero").getAttribute("data-hero")).toBe("bake-shop");
    await shot(page, "01-home");
    await expectTvRules();
  });

  it("opens a paused box on select: Continue at its resume point, New, who's here", async () => {
    await expect.poll(focused).toBe("game:bake-shop");
    await send(page, { type: "select", deviceId: "jonathan-phone" });
    await page.getByTestId("game-page").waitFor();
    expect(await page.getByTestId("action-continue").textContent()).toBe("Continue Day 4");
    expect(await page.getByTestId("game-page").textContent()).toContain("New game");
    await shot(page, "03b-game-page-paused");
    await expectTvRules();
    await send(page, { type: "back" });
    await page.getByTestId("game-page").waitFor({ state: "detached" });
  });

  it("moves the ring on focus.move, through the session", async () => {
    await expect.poll(focused).toBe("game:bake-shop");
    await send(page, { type: "focus.move", dir: "right" });
    await expect.poll(focused).toBe("game:story-nook");
    expect((await sessionState(page))?.focus).toBe("game:story-nook");
    await send(page, { type: "focus.move", dir: "down" });
    await expect.poll(focused).toBe("game:hearthisle");
    await send(page, { type: "focus.move", dir: "down" });
    await expect.poll(focused).toBe("game:rocket-crew");
    expect(await page.getByTestId("hero").getAttribute("data-hero")).toBe("rocket-crew");
    await shot(page, "02-focus-library");
    await expectTvRules();
  });

  it("starts a game from the remote, frames its view, then Home puts it back in its box", async () => {
    const boot = await bootId();
    await send(page, { type: "focus.set", itemId: "game:rocket-crew" });
    await expect.poll(focused).toBe("game:rocket-crew");

    await send(page, { type: "select", deviceId: "jonathan-phone" });
    await page.getByTestId("game-page").waitFor();
    await shot(page, "03-game-page");
    await expectTvRules();

    await send(page, { type: "select", deviceId: "jonathan-phone" });
    await page.getByTestId("starting").waitFor();
    expect(await page.getByTestId("starting").textContent()).toContain(
      "Starting Rocket Crew on Jonathan's phone",
    );
    expect((await sessionState(page))?.screen).toBe("game");
    await shot(page, "04-starting");
    await expectTvRules();

    await send(page, { type: "game.view", appId: "rocket-crew", url: ROCKET_TV });
    await expect.poll(() => attr(page, "game-frame", "src")).toBe(ROCKET_TV);
    await expect.poll(() => attr(page, "game-frame", "class")).toContain("live");
    // The framed game got ogs:start and answered with its resume point, forwarded to the session.
    await expect.poll(async () => (await sessionState(page))?.current?.label).toBe("Mission 6");
    const received = await receivedBy(page, "game-frame");
    expect(received).toEqual(["ogs:start"]);
    await shot(page, "05-game-framed");

    await send(page, { type: "home" });
    await page.locator('[data-testid=player][data-phase="hidden"]').waitFor({ state: "attached" });
    const box = page.locator('[data-row="continue"] [data-item="game:rocket-crew"]');
    expect(await box.textContent()).toContain("Mission 6");
    expect(await box.textContent()).toContain("Paused just now");
    await expect.poll(focused).toBe("game:rocket-crew");
    // The parked frame was told to suspend and stays loaded for an instant Continue.
    const afterHome = await receivedBy(page, "parked-frame");
    expect(afterHome).toEqual(["ogs:start", "ogs:suspend"]);
    await shot(page, "06-home-continue");
    await expectTvRules();

    expect(await bootId()).toBe(boot);
  });

  it("swaps games and resumes the parked one without reloading the launcher", async () => {
    const boot = await bootId();
    await send(page, { type: "game.start", appId: "rocket-crew", mode: "new" });
    await send(page, { type: "game.view", appId: "rocket-crew", url: ROCKET_TV });
    await expect.poll(() => attr(page, "game-frame", "class")).toContain("live");

    await send(page, { type: "game.start", appId: "bake-shop", mode: "continue" });
    await send(page, { type: "game.view", appId: "bake-shop", url: BAKE_TV });
    await expect.poll(() => attr(page, "game-frame", "src")).toBe(BAKE_TV);
    await expect.poll(() => attr(page, "game-frame", "class")).toContain("live");
    expect((await sessionState(page))?.casts).toBe(1);

    // Bake Shop says nothing back: Home still works, with the session's own label.
    await send(page, { type: "home" });
    await page.locator('[data-testid=player][data-phase="hidden"]').waitFor({ state: "attached" });
    const continueRow = await page
      .locator('[data-row="continue"] [data-item]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
    expect(continueRow.slice(0, 2)).toEqual(["game:bake-shop", "game:rocket-crew"]);
    expect(await page.locator('[data-item="game:bake-shop"]').textContent()).toContain("Day 4");

    await send(page, { type: "game.start", appId: "bake-shop", mode: "continue" });
    await expect.poll(() => attr(page, "game-frame", "src")).toBe(BAKE_TV);
    expect(await count(page, "[data-testid=starting]")).toBe(0);
    expect(await bootId()).toBe(boot);
    expect((await sessionState(page))?.casts).toBe(1);
  });

  it("shows a calm card when a game's frame never loads", async () => {
    page = await open(browser, "?fake=1&frameTimeout=1200");
    await page.getByTestId("home").waitFor();
    await send(page, { type: "game.start", appId: "night-flight", mode: "new" });
    await send(page, { type: "game.view", appId: "night-flight", url: BROKEN_TV });
    await page.getByTestId("frame-failed").waitFor({ timeout: 5000 });
    expect(await page.getByTestId("frame-failed").textContent()).toContain(
      "Choose another on Jonathan's phone",
    );
    await shot(page, "08-frame-failed");
    await expectTvRules();
  });

  it("keeps the last state with a reconnecting chip when the socket drops", async () => {
    await expect.poll(focused).toBe("game:bake-shop");
    await page.evaluate(() => window.__ogsFake?.drop());
    await page.getByTestId("reconnecting").waitFor();
    expect(await page.getByTestId("home").isVisible()).toBe(true);
    expect(await focused()).toBe("game:bake-shop");
    await shot(page, "09-reconnecting");
    await expectTvRules();
    await page.evaluate(() => window.__ogsFake?.restore());
    await expect.poll(() => count(page, "[data-testid=reconnecting]")).toBe(0);
  });
});

describe("the cut-over", () => {
  it("grows the focused box to full screen and shrinks it back into its box", async () => {
    page = await open(browser);
    await page.getByTestId("home").waitFor();
    await send(page, { type: "focus.set", itemId: "game:rocket-crew" });
    await expect.poll(focused).toBe("game:rocket-crew");
    await settle(page, 500);
    const box = await page.locator('[data-cover="rocket-crew"]').boundingBox();

    await send(page, { type: "game.start", appId: "rocket-crew", mode: "new" });
    const grow = await firstFrame(page);
    expect(grow.duration).toBeLessThanOrEqual(700);
    expect(grow.x).toBeCloseTo(box?.x ?? -1, 0);
    expect(grow.y).toBeCloseTo(box?.y ?? -1, 0);
    expect(grow.scale).toBeCloseTo((box?.width ?? 0) / 1920, 2);
    await midMotion(page, "04a-cutover-grow");

    await send(page, { type: "game.view", appId: "rocket-crew", url: ROCKET_TV });
    await expect.poll(() => attr(page, "game-frame", "class")).toContain("live");
    await send(page, { type: "home" });
    await page.locator('[data-row="continue"] [data-item="game:rocket-crew"]').waitFor();
    const target = await page.locator('[data-cover="rocket-crew"]').boundingBox();
    const shrink = await lastSmallFrame(page);
    expect(shrink.x).toBeCloseTo(target?.x ?? -1, 0);
    expect(shrink.y).toBeCloseTo(target?.y ?? -1, 0);
    // It lands on the Continue row where it rests, not where a shelf scroll would start.
    expect(shrink.y).toBeGreaterThan(488);
    await midMotion(page, "06a-cutover-shrink");
  });
});

/** The player animation's keyframe at the box (translate + scale), read from the running animation. */
async function boxKeyframe(p: Page, which: "first" | "smallest") {
  return p.getByTestId("player").evaluate((el, w) => {
    const a = el.getAnimations()[0];
    const effect = a?.effect;
    if (!a || !(effect instanceof KeyframeEffect)) throw new Error("no cut-over animation");
    const frames = effect.getKeyframes().map((k) => String(k.transform));
    const small = w === "first" ? frames[0] : frames.find((f) => f.includes("scale"));
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)/.exec(small ?? "");
    return {
      x: Number(m?.[1]),
      y: Number(m?.[2]),
      scale: Number(m?.[3]),
      duration: Number(effect.getTiming().duration),
    };
  }, which);
}
const firstFrame = (p: Page) => boxKeyframe(p, "first");
const lastSmallFrame = (p: Page) => boxKeyframe(p, "smallest");

/** Freeze the cut-over halfway and keep a picture of it. */
async function midMotion(p: Page, name: string) {
  await p.getByTestId("player").evaluate((el) => {
    for (const a of el.getAnimations()) {
      a.pause();
      a.currentTime = 300;
    }
  });
  await p.screenshot({ path: `${SHOTS}${name}.png` });
  await p.getByTestId("player").evaluate((el) => {
    for (const a of el.getAnimations()) a.play();
  });
}

describe("TV launcher before the session", () => {
  it("assembles the living room while connecting, not a black card", async () => {
    page = await open(browser, "?fake=1&hold=1");
    await page.getByTestId("assembling").waitFor();
    expect(await page.getByTestId("assembling").textContent()).toContain(
      "Setting up the living room",
    );
    await shot(page, "00-connecting");
    await expectTvRules();
    await page.evaluate(() => window.__ogsFake?.connect());
    await page.getByTestId("home").waitFor();
  });

  it("honours reduced motion: the cut-over is a short fade", async () => {
    page = await open(browser, "?fake=1", { reducedMotion: true });
    await page.getByTestId("home").waitFor();
    await send(page, { type: "game.start", appId: "rocket-crew", mode: "new" });
    const anim = await page
      .getByTestId("player")
      .evaluate((el) => el.getAnimations().map((a) => Number(a.effect?.getTiming().duration ?? 0)));
    expect(Math.max(...anim)).toBeLessThanOrEqual(200);
  });

  it("explains itself when opened without a launcher link", async () => {
    page = await open(browser, "?");
    await page.getByText("This TV page needs its link from the OGS app").waitFor();
  });
});
