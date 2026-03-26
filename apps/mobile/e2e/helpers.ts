import { device } from "detox";

/**
 * Complete onboarding by skipping it. Call before tests that need the home screen.
 */
export async function skipOnboarding(): Promise<void> {
  const { by, element, waitFor } = require("detox");
  try {
    await waitFor(element(by.id("onboardingSkipButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("homeScreen")))
      .toExist()
      .withTimeout(5000);
  } catch {
    // Already past onboarding
  }
}

/**
 * Launch with a fresh install and complete onboarding.
 */
export async function freshLaunchWithOnboardingDone(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    delete: true,
    permissions: { notifications: "YES" },
  });
  await skipOnboarding();
}

/**
 * Relaunch the app (preserving data).
 */
export async function relaunchApp(): Promise<void> {
  await device.launchApp({ newInstance: true });
}
