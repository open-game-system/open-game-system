import { by, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

/**
 * Navigate from home screen to settings.
 * Called after reloadReactNative puts us on home (onboarding already done).
 */
async function goToSettings(): Promise<void> {
  const { by, element, waitFor } = require("detox");
  await waitFor(element(by.id("homeScreen")))
    .toExist()
    .withTimeout(5000);
  await element(by.id("hamburgerMenu")).tap();
  await waitFor(element(by.id("settingsScreen")))
    .toExist()
    .withTimeout(3000);
}

describe("Settings", () => {
  // Use freshLaunchWithOnboardingDone in beforeEach — this handles
  // the global beforeEach(reloadReactNative) by doing delete:true + skipOnboarding.
  beforeEach(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("should open settings and show close button", async () => {
    await goToSettings();
    await expect(element(by.text("Settings"))).toBeVisible();
    await expect(element(by.id("settingsCloseButton"))).toBeVisible();
  });

  it("should show notification toggles", async () => {
    await goToSettings();
    await expect(element(by.text("Push Notifications"))).toBeVisible();
    await expect(element(by.id("pushNotificationsToggle"))).toExist();
    await expect(element(by.text("Sounds"))).toBeVisible();
    await expect(element(by.id("soundsToggle"))).toExist();
  });

  it("should show developer section with toggles", async () => {
    await goToSettings();
    await expect(element(by.text("Developer Mode"))).toBeVisible();
    await expect(element(by.id("developerModeToggle"))).toExist();
    await expect(element(by.text("Debug Overlay"))).toBeVisible();
    await expect(element(by.id("debugOverlayRow-disabled"))).toExist();
  });

  it("should enable debug overlay when developer mode is turned on", async () => {
    await goToSettings();
    await element(by.id("developerModeToggle")).tap();
    await expect(element(by.id("debugOverlayRow-enabled"))).toExist();
  });

  it("should show about section with version and links", async () => {
    await goToSettings();
    await expect(element(by.text("Version"))).toBeVisible();
    await expect(element(by.text("Open Game System"))).toBeVisible();
    await expect(element(by.text("Privacy Policy"))).toBeVisible();
  });

  it("should close settings and return to home", async () => {
    await goToSettings();
    await element(by.id("settingsCloseButton")).tap();
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(3000);
  });
});
