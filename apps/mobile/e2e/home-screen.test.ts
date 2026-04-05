import { by, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone, relaunchApp } from "./helpers";

describe("Home Screen", () => {
  // --- Empty State ---

  describe("Empty State", () => {
    beforeEach(async () => {
      await freshLaunchWithOnboardingDone();
    });

    it("should show OGS logo and title in the header", async () => {
      await expect(element(by.id("headerLogo"))).toBeVisible();
      await expect(element(by.text("OGS"))).toBeVisible();
    });

    it("should show hamburger menu icon", async () => {
      await expect(element(by.id("hamburgerMenu"))).toBeVisible();
    });

    it("should show welcome message when no games in Continue", async () => {
      await expect(element(by.text("Welcome to OGS"))).toBeVisible();
      await expect(
        element(
          by.text("Play web games with native superpowers. Pick a game below to get started."),
        ),
      ).toBeVisible();
    });

    it("should show Game Directory section with games", async () => {
      // In empty state the section is labeled "Game Directory"
      await expect(element(by.id("directoryGame-trivia-jam"))).toBeVisible();
      await expect(element(by.id("directoryGame-chess-online"))).toBeVisible();
    });

    it("should not show Continue section when no games", async () => {
      await expect(element(by.text("Continue"))).not.toBeVisible();
    });
  });

  // --- Game Directory ---

  describe("Game Directory", () => {
    beforeEach(async () => {
      await freshLaunchWithOnboardingDone();
    });

    it("should show game entries with name and description", async () => {
      await expect(element(by.text("Trivia Jam"))).toBeVisible();
    });

    it("should show Play button on each directory entry", async () => {
      await expect(element(by.id("directoryPlayButton-trivia-jam"))).toBeVisible();
    });

    it("should navigate to game detail when tapping a directory entry", async () => {
      await element(by.id("directoryGame-trivia-jam")).tap();
      await waitFor(element(by.id("gameDetailScreen")))
        .toExist()
        .withTimeout(3000);
    });
  });

  // --- Navigation ---

  describe("Navigation", () => {
    beforeEach(async () => {
      await freshLaunchWithOnboardingDone();
    });

    it("should open settings when tapping hamburger menu", async () => {
      await element(by.id("hamburgerMenu")).tap();
      await waitFor(element(by.id("settingsScreen")))
        .toExist()
        .withTimeout(3000);
    });

    it("should show home screen on cold start after onboarding", async () => {
      await relaunchApp();
      await waitFor(element(by.id("homeScreen")))
        .toExist()
        .withTimeout(5000);
    });
  });

  // --- Layout ---

  describe("Layout", () => {
    beforeEach(async () => {
      await freshLaunchWithOnboardingDone();
    });

    it("should be a single scrollable view with no tab bar", async () => {
      await expect(element(by.id("homeScrollView"))).toExist();
      await expect(element(by.id("tabBar"))).not.toExist();
    });
  });
});
