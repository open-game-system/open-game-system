import { by, device, element, expect, waitFor } from "detox";

describe("App Launch (onboarding completed)", () => {
  beforeAll(async () => {
    // Complete onboarding first
    await device.launchApp({ newInstance: true, delete: true });
    await waitFor(element(by.id("onboardingSkipButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(5000);
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("should open on the Library", async () => {
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(5000);
  });

  it("should show the five tabs", async () => {
    await expect(element(by.id("tabPlaying"))).toBeVisible();
    await expect(element(by.id("tabTV"))).toBeVisible();
    await expect(element(by.id("tabLibrary"))).toBeVisible();
    await expect(element(by.id("tabFriends"))).toBeVisible();
    await expect(element(by.id("tabProfile"))).toBeVisible();
  });
});
