import { by, device, element, expect, waitFor } from "detox";

describe("Onboarding — Full Flow", () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: "YES" },
    });
    await waitFor(element(by.id("onboardingScreen")))
      .toExist()
      .withTimeout(10000);
  });

  it("should show page 1 with features and navigation", async () => {
    await expect(element(by.text("Web games, supercharged"))).toBeVisible();
    await expect(element(by.text("Notifications"))).toBeVisible();
    await expect(element(by.text("TV Casting"))).toBeVisible();
    await expect(element(by.text("Native Feel"))).toBeVisible();
    await expect(element(by.id("onboardingNextButton"))).toBeVisible();
    await expect(element(by.id("onboardingSkipButton"))).toBeVisible();
    await expect(element(by.id("pageDot-0-active"))).toExist();
  });

  it("should navigate to completion page and finish (skips notifications when pre-granted)", async () => {
    // Tap Next — since notifications are pre-granted, page 2 is skipped
    // and we go directly to page 3 ("You're all set")
    await element(by.id("onboardingNextButton")).tap();
    await waitFor(element(by.text("You're all set")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("onboardingLetsGoButton"))).toBeVisible();

    // Page 3 → Home
    await element(by.id("onboardingLetsGoButton")).tap();
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id("onboardingScreen"))).not.toExist();
  });

  it("should not show onboarding on relaunch after completion", async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id("onboardingScreen"))).not.toExist();
  });
});

describe("Onboarding — Skip Flow", () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
      permissions: { notifications: "YES" },
    });
    await waitFor(element(by.id("onboardingScreen")))
      .toExist()
      .withTimeout(10000);
  });

  it("should go directly to home when tapping Skip", async () => {
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
  });

  it("should not show onboarding on relaunch after skipping", async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id("onboardingScreen"))).not.toExist();
  });
});
