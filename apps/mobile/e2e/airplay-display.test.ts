import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { by, device, element, waitFor } from "detox";

// Acceptance: 2026-10-23-airplay-display.feature. The Simulator's external display (I/O > External
// Displays) stands in for an Apple TV with Screen Mirroring on: the phone renders the OGS TV launcher
// on it and keeps its own screen. Needs a build with EXPO_PUBLIC_FAKE_CAST=none against a local API
// (E2E_OGS_API, with CATALOGUE_START_URLS for GAME) and launcher (EXPO_PUBLIC_OGS_TV), and the
// Terminal allowed to click the Simulator menu (System Events). Shots of both screens go to E2E_SHOTS.
//   DETOX_SIM_NAME=<sim> DETOX_IOS_BINARY=<app> E2E_SHOTS=<dir> pnpm exec detox test \
//     --configuration ios.sim.release e2e/airplay-display.test.ts
const GAME = process.env.AIRPLAY_GAME ?? "night-flight";
const SIM_NAME = process.env.DETOX_SIM_NAME ?? "";
const SCRIPT = resolve(__dirname, "../../../packages/shell/scripts/airplay-sim.sh");
const WALK_MS = 300_000;

const visible = (id: string, ms = 10000) =>
  waitFor(element(by.id(id)))
    .toBeVisible()
    .withTimeout(ms);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function externalDisplay(size: "1920×1080 (1080p)" | "Disabled") {
  execFileSync("bash", [SCRIPT, SIM_NAME, size], { timeout: 60_000 });
}

async function shotPhone(name: string) {
  const path = await device.takeScreenshot(name);
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  copyFileSync(path, join(dir, `${name}-phone.png`));
}

function shotTv(name: string) {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  execFileSync(
    "xcrun",
    ["simctl", "io", device.id, "screenshot", "--display=external", join(dir, `${name}-tv.png`)],
    { timeout: 30_000 },
  );
}

async function onboard(name: string) {
  await visible("onboardingMakeProfile", 30000);
  await element(by.id("onboardingMakeProfile")).tap();
  try {
    await waitFor(element(by.id("onboardingMaybeLaterButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("onboardingMaybeLaterButton")).tap();
  } catch {}
  await visible("profileNameInput");
  await element(by.id("profileNameInput")).typeText(name);
  await element(by.id("profileNameInput")).tapReturnKey();
  await waitFor(element(by.id("profileHandleStatus")))
    .toHaveText("free")
    .withTimeout(10000);
  await waitFor(element(by.id("profileNext")))
    .toBeVisible()
    .whileElement(by.id("profileStep"))
    .scroll(150, "down");
  await element(by.id("profileNext")).tap();
  await visible("profileDoneGreeting");
  await element(by.id("onboardingLetsGoButton")).tap();
}

describe("An Apple TV through Screen Mirroring (the Simulator's external display)", () => {
  afterAll(() => externalDisplay("Disabled"));

  it(
    "casts the launcher to the external display, rendered by the phone, while the phone keeps the game",
    async () => {
      // The display goes on after launch: one already on when the app starts can stay at 720x480 in
      // the Simulator (a real Apple TV gives its own mode).
      externalDisplay("Disabled");
      await device.launchApp({
        newInstance: true,
        delete: true,
        permissions: { notifications: "YES" },
      });
      await onboard("Dana");
      await device.launchApp({ newInstance: true });
      externalDisplay("1920×1080 (1080p)");
      await pause(4000);
      shotTv("airplay-01-idle");

      await waitFor(element(by.id("libraryScreen")))
        .toExist()
        .withTimeout(15000);
      await waitFor(element(by.id(`libraryGame-${GAME}`)))
        .toBeVisible()
        .whileElement(by.id("libraryScreen"))
        .scroll(200, "down");
      await element(by.id(`libraryGame-${GAME}`)).tap();
      await visible("gamePlay");
      await element(by.id("gamePlay")).tap();
      // A display is connected, so the Apple TV is offered (the Simulator names no receiver).
      await waitFor(element(by.id("castPromptTV-airplay")))
        .toExist()
        .withTimeout(15000);
      await shotPhone("airplay-02-prompt");
      await element(by.id("castPromptTV-airplay")).tap();
      await element(by.id("castPromptConfirm")).tap();

      // The game opens on the phone (its controller page) once the launcher on the TV is up.
      await waitFor(element(by.id("swipeHintOverlay")))
        .toExist()
        .withTimeout(60000);
      await pause(8000);
      await shotPhone("airplay-03-playing");
      shotTv("airplay-03-playing");

      // Away: the TV says to keep the app open.
      await device.sendToHome();
      await pause(1500);
      shotTv("airplay-04-away");
      await device.launchApp({ newInstance: false });
      await pause(2000);
      shotTv("airplay-05-back");
    },
    WALK_MS,
  );
});
