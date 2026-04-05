import { by, device, element, expect, waitFor } from "detox";
import { skipOnboarding } from "./helpers";

describe("Continue Lifecycle", () => {
  describe("Adding games to Continue", () => {
    beforeAll(async () => {
      await device.launchApp({
        newInstance: true,
        permissions: { notifications: "YES" },
      });
      await skipOnboarding();
    });

    it("should not show Continue section before playing any games", async () => {
      // "Your Games" header only shows when hasContinueGames is true
      await expect(element(by.text("Your Games"))).not.toBeVisible();
      // Welcome message shows instead
      await expect(element(by.text("Welcome to OGS"))).toBeVisible();
    });

    it("should show game in Continue after launching and relaunching app", async () => {
      // Navigate to game detail and tap Play
      await element(by.id("directoryGame-trivia-jam")).tap();
      await waitFor(element(by.id("gameDetailScreen")))
        .toExist()
        .withTimeout(3000);
      await element(by.id("gameDetailPlayButton")).tap();

      // Relaunch without waiting for game screen
      await device.disableSynchronization();
      await new Promise((r) => setTimeout(r, 1000));
      await device.launchApp({ newInstance: true });
      await device.enableSynchronization();

      await waitFor(element(by.id("homeScreen")))
        .toExist()
        .withTimeout(10000);

      // "Your Games" header appears when Continue has entries
      await waitFor(element(by.text("Your Games")))
        .toBeVisible()
        .withTimeout(5000);

      // The game name should be visible in the Continue section
      await expect(element(by.id("continueGame-trivia-jam"))).toBeVisible();
    });
  });

  describe("Persistence across force quit", () => {
    it("should preserve Continue list after force quit and relaunch", async () => {
      await device.launchApp({ newInstance: true });

      await waitFor(element(by.id("homeScreen")))
        .toExist()
        .withTimeout(10000);

      await waitFor(element(by.text("Your Games")))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
