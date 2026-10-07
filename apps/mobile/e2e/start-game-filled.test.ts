import { readFileSync } from "node:fs";
import { by, element, expect, waitFor } from "detox";
import { PNG } from "pngjs";
import { castSittings, freshLaunchWithOnboardingDone, until } from "./helpers";

/**
 * Owner, 2026-10-04: the game page's one filled button is its footer: Play with nothing to rejoin,
 * Start game beside sittings; every sitting's Rejoin is outlined. The Library hero is full bleed
 * with Play over the art. Acceptance 2026-10-03-cast-first-app.feature ("Start game" ... the page's
 * one filled button). The look is read from the pixels on screen: a filled button is the lamp
 * colour (#ffc861) behind its label, an outlined one shows the page through it.
 *
 * Needs the local API (EXPO_PUBLIC_OGS_API / E2E_OGS_API) and a fake Chromecast (EXPO_PUBLIC_FAKE_CAST).
 */
const LAMP = { r: 0xff, g: 0xc8, b: 0x61 };

/** The share of an element's on-screen pixels that are the lamp colour (0..1). */
async function lampShare(match: Detox.NativeElement): Promise<number> {
  const png = PNG.sync.read(readFileSync(await match.takeScreenshot("look")));
  let lamp = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const near =
      Math.abs(png.data[i] - LAMP.r) < 24 &&
      Math.abs(png.data[i + 1] - LAMP.g) < 24 &&
      Math.abs(png.data[i + 2] - LAMP.b) < 24;
    if (near) lamp++;
  }
  return lamp / (png.data.length / 4);
}

async function expectFilled(name: string, match: Detox.NativeElement): Promise<void> {
  const share = await lampShare(match);
  if (share < 0.4) throw new Error(`${name} is not filled: ${(share * 100).toFixed(0)}% lamp`);
}

async function expectOutlined(name: string, match: Detox.NativeElement): Promise<void> {
  const share = await lampShare(match);
  if (share > 0.05) throw new Error(`${name} is not outlined: ${(share * 100).toFixed(0)}% lamp`);
}

type Frame = { x: number; y: number; width: number; height: number };
async function frameOf(id: string): Promise<Frame> {
  const attrs = await element(by.id(id)).getAttributes();
  if (!("frame" in attrs)) throw new Error(`${id}: no frame`);
  return attrs.frame;
}

describe("The game page's one filled button", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("Library: the hero's Play sits over the art and is filled", async () => {
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("libraryHeroPlay")))
      .toBeVisible()
      .withTimeout(10000);
    const art = await frameOf("libraryHero");
    const play = await frameOf("libraryHeroPlay");
    const inside =
      play.x >= art.x &&
      play.y >= art.y &&
      play.x + play.width <= art.x + art.width &&
      play.y + play.height <= art.y + art.height;
    if (!inside) throw new Error(`Play is not over the art: ${JSON.stringify({ art, play })}`);
    await expectFilled("Library hero Play", element(by.id("libraryHeroPlay")));
  });

  it("no sittings: Play is filled; with a sitting: Start game is filled and Rejoin outlined", async () => {
    // Cast first, so Play starts the game at once (the prompt is play-cta.test.ts).
    await element(by.id("tabTV")).tap();
    try {
      await waitFor(element(by.id("castButton")))
        .toBeVisible()
        .withTimeout(2000);
      await element(by.id("castButton")).tap();
    } catch {}
    await waitFor(element(by.id("remoteOk")))
      .toBeVisible()
      .withTimeout(15000);

    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("libraryGame-rocket-crew")))
      .toBeVisible()
      .whileElement(by.id("libraryScreen"))
      .scroll(200, "down");
    await element(by.id("libraryGame-rocket-crew")).tap();
    await waitFor(element(by.id("gamePlay")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("gameSittings"))).not.toExist();
    await expect(element(by.id("gameNew"))).not.toExist();
    await expectFilled("Play", element(by.id("gamePlay")));

    // Start a sitting, swipe back to the page: it lists the sitting.
    await element(by.id("gamePlay")).tap();
    await waitFor(element(by.id("gameScreen")))
      .toExist()
      .withTimeout(20000);
    await waitFor(element(by.id("swipeHintOverlay")))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id("swipeHintOverlay")).swipe("right", "fast", 0.8, 0.02, 0.5);
    await waitFor(element(by.id("gameSittings")))
      .toExist()
      .withTimeout(5000);

    // The footer is now Start game, filled; Play is gone; the sitting's Rejoin is outlined.
    await waitFor(element(by.id("gameNew")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("gameNew"))).toHaveLabel("Start game");
    await expect(element(by.id("gamePlay"))).not.toExist();
    await expectFilled("Start game", element(by.id("gameNew")));
    // Detox on iOS matches ids by name only (docs/lessons.md): the sitting's id from the API.
    const [sitting] = await until(
      () => castSittings("rocket-crew"),
      (l) => l.length > 0,
      15000,
    );
    if (!sitting) throw new Error("the API lists no Rocket Crew sitting");
    const rejoin = element(by.id(`gameSittingRejoin-${sitting.instanceId}`));
    await waitFor(rejoin).toBeVisible().withTimeout(5000);
    await expectOutlined("Rejoin", rejoin);
  });
});
