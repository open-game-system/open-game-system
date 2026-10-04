import { by, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Spec v3, In a game: full screen, no tabs; swiping back from the left edge returns to the tab
// and leaves the return pill. Games open from Library (the Game Directory is gone). Cast with
// EXPO_PUBLIC_FAKE_CAST=1 so a TV-required game opens as the controller.
// e2e/setup.ts reloads React Native before every test, so each test opens the game itself.
describe("Game Screen", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  beforeEach(async () => {
    await element(by.id("tabTV")).tap();
    // After the reload the session may already say the TV is cast: then the tab is the remote.
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
      .withTimeout(10000);
    await element(by.id("libraryGame-rocket-crew")).tap();
    await waitFor(element(by.id("gameScreen")))
      .toExist()
      .withTimeout(5000);
  });

  it("shows the game with zero OGS chrome", async () => {
    await expect(element(by.id("gameWebView"))).toExist();
    await expect(element(by.id("tabLibrary"))).not.toBeVisible();
  });

  it("swipes back from the left edge to the tabs and leaves a Back in pill", async () => {
    // The first-visit hint covers the game and teaches the swipe; swiping on it must work.
    await waitFor(element(by.id("swipeHintOverlay")))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id("swipeHintOverlay")).swipe("right", "fast", 0.8, 0.02, 0.5);
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id("returnPill"))).toBeVisible();
    await element(by.id("tabPlaying")).tap();
    await expect(element(by.id("returnPill"))).toBeVisible();
  });
});
