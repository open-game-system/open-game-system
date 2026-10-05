import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { by, device, element, expect, waitFor, web } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Owner, 2026-10-04: "it should just be Play, and then if they are not already casting, we prompt
// them to cast." Not cast, Play opens the cast prompt (pick a TV, Cast, Not now); cast,
// Play starts at once. Needs the local API (EXPO_PUBLIC_OGS_API) and a fake Chromecast whose /load
// the build casts to (EXPO_PUBLIC_FAKE_CAST=2, EXPO_PUBLIC_FAKE_CAST_URL=$FAKE_CAST/load).
// E2E_SHOTS: a folder to copy the screenshots into.
const CAST = process.env.FAKE_CAST ?? "http://localhost:5181";

type Tv = {
  loads: number;
  dom: { screen: string | null; frameApp: string | null; starting: boolean } | null;
};
const tv = async (): Promise<Tv> => (await fetch(`${CAST}/launcher`)).json() as Promise<Tv>;

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms: number): Promise<T> {
  const end = Date.now() + ms;
  let last = await read();
  while (!ok(last) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    last = await read();
  }
  return last;
}

async function shot(name: string): Promise<void> {
  const path = await device.takeScreenshot(name);
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  copyFileSync(path, join(dir, `${name}.png`));
}

/** Rocket Crew declares its TV page once the host has a crew name (as e2e/tests/app.e2e.ts does). */
async function joinRocketCrew(): Promise<void> {
  // The game screen holds one web view (gameWebView is its container): Detox's default web view.
  const page = web;
  // Typed through the page's own input setter, so the game's React state sees the name.
  const fill = `(input) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(input, "Dad");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }`;
  for (let i = 0; i < 30; i++) {
    try {
      await page.element(by.web.cssSelector("input")).runScript(fill);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  await new Promise((r) => setTimeout(r, 500));
  await page
    .element(by.web.xpath("//button[contains(translate(., 'join', 'JOIN'), 'JOIN')]"))
    .runScript("(button) => button.click()");
}

async function openPage(appId: string): Promise<void> {
  await element(by.id("tabLibrary")).tap();
  await waitFor(element(by.id(`libraryGame-${appId}`)))
    .toBeVisible()
    .whileElement(by.id("libraryScreen"))
    .scroll(200, "down");
  await element(by.id(`libraryGame-${appId}`)).tap();
  await waitFor(element(by.id("gamePlay")))
    .toBeVisible()
    .withTimeout(5000);
}

describe("Play, then cast if not casting", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("not cast: Library's hero says Play, never Cast to play", async () => {
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("libraryHeroPlay")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("libraryHeroPlay"))).toHaveLabel("Play Rocket Crew");
    await expect(element(by.text("Cast to play"))).not.toExist();
    await shot("01-library-hero-play");
  });

  it("Not now closes the cast prompt and casts nothing", async () => {
    const before = (await tv()).loads;
    await openPage("rocket-crew");
    await shot("02-game-page-play");
    await element(by.id("gamePlay")).tap();
    await waitFor(element(by.id("castPromptTitle")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("castPrompt"))).toExist();
    await expect(element(by.id("castPromptTitle"))).toHaveText("Play Rocket Crew on the TV");
    await expect(element(by.id("castPromptPhone"))).not.toExist();
    await element(by.id("castPromptDismiss")).tap();
    await waitFor(element(by.id("castPrompt")))
      .not.toExist()
      .withTimeout(5000);
    await expect(element(by.id("gamePlay"))).toBeVisible();
    const after = (await tv()).loads;
    if (after !== before) throw new Error(`Not now cast anyway: ${before} → ${after} loads`);
  });

  it("Play → the prompt lists the TVs → Cast: the game opens and the TV frames it", async () => {
    await openPage("rocket-crew");
    await element(by.id("gamePlay")).tap();
    await waitFor(element(by.id("castPromptTV-fake-living-room")))
      .toBeVisible()
      .withTimeout(5000);
    // The second TV turns up a moment later, as real discovery does.
    await waitFor(element(by.id("castPromptTV-fake-bedroom")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("castPromptTV-fake-living-room")).tap();
    await shot("03-cast-prompt");
    await element(by.id("castPromptConfirm")).tap();
    await waitFor(element(by.id("gameScreen")))
      .toExist()
      .withTimeout(20000);
    await expect(element(by.id("castPrompt"))).not.toExist();
    await joinRocketCrew();
    const framed = await until(tv, (t) => t.dom?.frameApp === "rocket-crew", 45000);
    if (framed.dom?.frameApp !== "rocket-crew")
      throw new Error(`the TV never framed Rocket Crew: ${JSON.stringify(framed.dom)}`);
    await shot("04-rocket-crew-playing");
  });

  it("already cast: Play starts the game at once, no prompt", async () => {
    // e2e/setup.ts reloads React Native before every test, which drops the fake cast session:
    // cast again from the TV tab (the same launcher, so the TV doesn't reload).
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
    const before = await tv();
    await openPage("bake-shop");
    await element(by.id("gamePlay")).tap();
    await waitFor(element(by.id("gameScreen")))
      .toExist()
      .withTimeout(10000);
    await expect(element(by.id("castPrompt"))).not.toExist();
    // The deployed Bake Shop only declares its TV page once someone joins; the TV getting it
    // ready ("Getting ready") is the proof Play started it there without asking to cast.
    const after = await until(
      tv,
      (t) => t.dom?.screen === "game" && (t.dom.starting || t.dom.frameApp === "bake-shop"),
      20000,
    );
    if (after.dom?.screen !== "game" || !(after.dom.starting || after.dom.frameApp === "bake-shop"))
      throw new Error(`the TV never started Bake Shop: ${JSON.stringify(after.dom)}`);
    // Swapping games never recasts.
    if (after.loads !== before.loads) throw new Error(`recast: ${before.loads} → ${after.loads}`);
  });

  it("Stop casting: the TV tab says Stopped casting the moment it's confirmed, and the TV closes", async () => {
    // Cast again after setup.ts's reload (as above).
    await element(by.id("tabTV")).tap();
    try {
      await waitFor(element(by.id("castButton")))
        .toBeVisible()
        .withTimeout(2000);
      await element(by.id("castButton")).tap();
    } catch {}
    await waitFor(element(by.id("remoteEnd")))
      .toBeVisible()
      .withTimeout(15000);
    // After the reload the remote can show from the couch session alone, with no cast session of
    // this phone's: pick Living room TV so this phone casts to it (and Stop casting can name it).
    await element(by.id("tvPickerOpen")).tap();
    await waitFor(element(by.id("tvPickerDevice-fake-living-room")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("tvPickerDevice-fake-living-room")).tap();
    await waitFor(element(by.id("tvPicker")))
      .not.toBeVisible()
      .withTimeout(15000);
    await element(by.id("remoteEnd")).tap();
    await waitFor(element(by.id("remoteEndConfirm")))
      .toBeVisible()
      .withTimeout(5000);
    // Detox would wait for the stop's network reply before looking: look without waiting, so this
    // measures what the phone shows, not when the TV answers (the fake TV takes ~2.6 s).
    await device.disableSynchronization();
    try {
      await element(by.id("remoteEndConfirm")).tap();
      await waitFor(element(by.id("castStopped")))
        .toBeVisible()
        .withTimeout(1000);
      await expect(element(by.id("tvRemote"))).not.toExist();
    } finally {
      await device.enableSynchronization();
    }
    await expect(element(by.text("Stopped casting on\nLiving room TV"))).toBeVisible();
    await shot("05-stopped-casting");
    const closed = await until(tv, (t) => t.dom === null, 10000);
    if (closed.dom !== null) throw new Error(`the TV is still open: ${JSON.stringify(closed.dom)}`);
  });
});
