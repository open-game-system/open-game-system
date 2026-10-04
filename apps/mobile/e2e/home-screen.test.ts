import { by, device, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Spec v3, App structure: three tabs (Playing · TV · Library), always all three. Supersedes the
// single-scroll home screen (Continue + Game Directory) of 2026-03-15-ogs-app-home-screen.feature.
describe("Tabs", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("opens on Library when nothing is live", async () => {
    await expect(element(by.id("libraryScreen"))).toExist();
  });

  it("shows Playing, TV and Library", async () => {
    await expect(element(by.id("tabPlaying"))).toBeVisible();
    await expect(element(by.id("tabTV"))).toBeVisible();
    await expect(element(by.id("tabLibrary"))).toBeVisible();
  });

  it("TV shows one big Cast button before casting", async () => {
    await element(by.id("tabTV")).tap();
    await waitFor(element(by.id("castButton")))
      .toBeVisible()
      .withTimeout(3000);
  });

  it("Playing is never a dead end", async () => {
    await element(by.id("tabPlaying")).tap();
    await waitFor(element(by.id("playingScreen")))
      .toExist()
      .withTimeout(3000);
  });

  it("Library offers + Add games", async () => {
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("addGames")))
      .toBeVisible()
      .whileElement(by.id("libraryScreen"))
      .scroll(300, "down");
  });

  it("opens settings from the household button", async () => {
    await element(by.id("tabLibrary")).tap();
    await element(by.id("householdButton")).tap();
    await waitFor(element(by.id("settingsScreen")))
      .toExist()
      .withTimeout(3000);
    await element(by.id("settingsCloseButton")).tap();
  });

  it("opens on Library again on a cold start", async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(8000);
  });
});
