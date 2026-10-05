import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isIdle } from "../../../services/api/container/src/stream-lifetime";
import { BASE, launch, send } from "./harness";

/**
 * The stream server's idle stop, end to end on the launcher side: the renderer reads
 * `window.__ogsActivityAt` from the page it streams (page.evaluate, at each heartbeat) and ends the
 * cast when isIdle says so (20 minutes, STREAM_IDLE_MS). Here the launcher runs in a real browser
 * on a virtual clock, and the same read and the same rule decide.
 */
const IDLE_MS = 20 * 60 * 1000;
const MIN = 60 * 1000;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.clock.install({ time: new Date(2026, 9, 4, 19, 0) });
  await page.goto(`${BASE}/?fake=1`);
  await page.waitForFunction(() => typeof window.__ogsActivityAt === "number");
});
afterAll(async () => {
  await browser.close();
});

/** What the renderer's heartbeat check decides right now. */
async function rendererSaysIdle(): Promise<boolean> {
  const activityAt = await page.evaluate("window.__ogsActivityAt");
  const now = await page.evaluate(() => Date.now());
  return isIdle(activityAt, now, IDLE_MS);
}

describe("a launcher cast left on with nobody around ends after 20 minutes", () => {
  it("is not idle while phones and the tablet are on the couch session, all evening", async () => {
    expect(await rendererSaysIdle()).toBe(false);
    await page.clock.runFor(90 * MIN);
    expect(await rendererSaysIdle()).toBe(false);
  });

  it("is idle 20 minutes after every phone and tablet left", async () => {
    for (const deviceId of ["jonathan-phone", "mom-phone", "juneau-ipad"])
      await send(page, { type: "bye", deviceId });
    await page.clock.runFor(19 * MIN);
    expect(await rendererSaysIdle()).toBe(false);
    await page.clock.runFor(2 * MIN);
    expect(await rendererSaysIdle()).toBe(true);
  });

  it("is awake again the moment a phone comes back", async () => {
    await send(page, { type: "hello", deviceId: "mom-phone", kind: "phone" });
    expect(await rendererSaysIdle()).toBe(false);
  });
});
