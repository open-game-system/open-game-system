import { by, device, element, expect, waitFor } from "detox";

describe("App Launch (onboarding completed)", () => {
  beforeAll(async () => {
    // Complete onboarding first
    await device.launchApp({ newInstance: true, delete: true });
    await waitFor(element(by.id("onboardingSkipButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("should show the home screen", async () => {
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.id("headerLogo"))).toBeVisible();
  });

  it("should show the OGS header text", async () => {
    await expect(element(by.text("OGS"))).toBeVisible();
  });
});
