import { by, device, element, expect, waitFor } from "detox";
import { uniqueEmail } from "./helpers";

/**
 * Onboarding's Back works on every step (acceptance 2026-03-15-ogs-app-onboarding.feature, "Back
 * on every page after the welcome"). Notifications are NOT pre-granted here, so the notifications
 * page is in the walk (onboarding.test.ts pre-grants them, which passes over it). The sign-in sheet
 * opened from onboarding has its own ways back: Use another email (code → address) and Not now
 * (sheet → the welcome). The done page has no Back (the profile is made): onboarding.test.ts.
 *
 * setup.ts reloads React Native before every test, which restarts onboarding: one walk, one test.
 */
const page = (i: number) => element(by.id(`pageDot-${i}-active`));

async function onPage(i: number): Promise<void> {
  await waitFor(page(i)).toExist().withTimeout(5000);
}

describe("Onboarding: Back on every step", () => {
  beforeAll(async () => {
    // A fresh install with notifications undecided: the notifications page shows.
    await device.launchApp({ newInstance: true, delete: true });
    await waitFor(element(by.id("onboardingScreen")))
      .toExist()
      .withTimeout(10000);
  });

  it("welcome ⇄ notifications ⇄ profile, and the sign-in sheet's code step and Not now", async () => {
    // Welcome: no Back.
    await onPage(0);
    await expect(element(by.id("onboardingBack"))).not.toExist();

    // Make my profile → notifications → Back → welcome.
    await element(by.id("onboardingMakeProfile")).tap();
    await waitFor(element(by.id("onboardingMaybeLaterButton")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(1);
    await expect(element(by.id("onboardingBack"))).toBeVisible();
    await element(by.id("onboardingBack")).tap();
    await waitFor(element(by.id("onboardingMakeProfile")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(0);
    await expect(element(by.id("onboardingBack"))).not.toExist();

    // Make my profile → notifications → Maybe later → profile → Back → notifications → Back → welcome.
    await element(by.id("onboardingMakeProfile")).tap();
    await waitFor(element(by.id("onboardingMaybeLaterButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("onboardingMaybeLaterButton")).tap();
    await waitFor(element(by.id("profileStep")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(2);
    await element(by.id("profileNameInput")).typeText("Back Walk");
    await element(by.id("onboardingBack")).tap();
    await waitFor(element(by.id("onboardingMaybeLaterButton")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(1);
    await element(by.id("onboardingBack")).tap();
    await waitFor(element(by.id("onboardingMakeProfile")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(0);

    // Skip lands on the profile step; with notifications undecided, Back returns to their page.
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("profileStep")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(2);
    // What was typed is still there.
    await expect(element(by.id("profileNameInput"))).toHaveText("Back Walk");
    await element(by.id("onboardingBack")).tap();
    await waitFor(element(by.id("onboardingMaybeLaterButton")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(1);
    await element(by.id("onboardingBack")).tap();
    await onPage(0);

    // I already have a profile → the sheet. Send a code, then Use another email: the address again.
    await element(by.id("onboardingSignIn")).tap();
    await waitFor(element(by.id("signInEmailInput")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("signInEmailInput")).typeText(uniqueEmail("back"));
    await element(by.id("signInEmailInput")).tapReturnKey();
    await element(by.id("signInSendCode")).tap();
    await waitFor(element(by.id("signInCodeInput")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.label("Use another email")).tap();
    await waitFor(element(by.id("signInEmailInput")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("signInCodeInput"))).not.toExist();

    // Not now closes the sheet: back on the welcome, still in onboarding.
    await element(by.id("signInNotNow")).tap();
    await waitFor(element(by.id("onboardingMakeProfile")))
      .toBeVisible()
      .withTimeout(5000);
    await onPage(0);
    await expect(element(by.id("signInScreen"))).not.toExist();
  });
});
