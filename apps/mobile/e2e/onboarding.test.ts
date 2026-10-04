import { by, device, element, expect, waitFor } from "detox";
import { continueWithEmail, makeProfile, uniqueEmail } from "./helpers";

/** Spec ogs-profiles, 1 · Onboarding; acceptance 2026-10-04-ogs-profiles.feature. */

async function freshInstall() {
  await device.launchApp({
    newInstance: true,
    delete: true,
    permissions: { notifications: "YES" },
  });
  await waitFor(element(by.id("onboardingScreen")))
    .toExist()
    .withTimeout(10000);
}

const textOf = async (id: string): Promise<string> => {
  const attrs = await element(by.id(id)).getAttributes();
  return "text" in attrs && typeof attrs.text === "string" ? attrs.text : "";
};

const email = uniqueEmail("jonathan");
let handle = "";

// setup.ts reloads React Native before every test, which restarts onboarding: each scenario that
// walks through onboarding is one test.
describe("Onboarding: make your OGS profile", () => {
  beforeAll(freshInstall);

  it("makes a profile (@id from the name), backs it up with email, and shows it on Profile", async () => {
    // Page 1: Next, Skip, and signing in to an existing profile.
    await expect(element(by.text("Web games, supercharged"))).toBeVisible();
    await expect(element(by.id("onboardingSkipButton"))).toBeVisible();
    await expect(element(by.id("onboardingSignInButton"))).toBeVisible();
    await expect(element(by.id("pageDot-0-active"))).toExist();

    // Notifications are pre-granted, so Next goes straight to the profile step. No family step.
    await element(by.id("onboardingNextButton")).tap();
    await waitFor(element(by.text("Make your OGS profile")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text("Who's in your family?"))).not.toExist();
    await element(by.id("profileNameInput")).typeText("Jonathan Mumm");
    await element(by.id("profileNameInput")).tapReturnKey();
    await waitFor(element(by.id("profileHandleStatus")))
      .toHaveText("free")
      .withTimeout(10000);
    handle = await textOf("profileHandleInput");
    // "@jonathan.m", or a free variant when an earlier run already took it.
    if (!/^jonathan\.m\d*$/.test(handle)) throw new Error(`unexpected @id: ${handle}`);
    await element(by.id("profileSticker-owl")).tap();

    // Next makes the profile; the done page greets and offers Back up and Let's go.
    await waitFor(element(by.id("profileNext")))
      .toBeVisible()
      .whileElement(by.id("profileStep"))
      .scroll(150, "down");
    await element(by.id("profileNext")).tap();
    await waitFor(element(by.id("profileDone")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("profileDoneGreeting"))).toHaveText("Hi, Jonathan");
    await expect(element(by.id("profileDoneHandle"))).toHaveText(`@${handle}`);
    await expect(element(by.id("onboardingLetsGoButton"))).toBeVisible();

    // Back up with email (the 6-digit code comes from the emulated inbox).
    await element(by.id("profileDoneBackUp")).tap();
    await continueWithEmail(email);
    await waitFor(element(by.id("profileDoneBackedUp")))
      .toHaveText("Backed up with email")
      .withTimeout(10000);

    // Let's go: Library; the Profile tab shows the real profile.
    await element(by.id("onboardingLetsGoButton")).tap();
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(10000);
    await element(by.id("tabProfile")).tap();
    await waitFor(element(by.id("profileName")))
      .toHaveText("Jonathan Mumm")
      .withTimeout(5000);
    await expect(element(by.id("profileHandle"))).toHaveText(`@${handle}`);
    await expect(element(by.id("profileBackupStatus"))).toHaveText("Backed up with email");
  });

  it("does not show onboarding on relaunch", async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(10000);
    await expect(element(by.id("onboardingScreen"))).not.toExist();
  });
});

describe("Next stays above the keyboard on the profile step (no return key first)", () => {
  beforeAll(freshInstall);

  it("type a name, and Next is visible and makes the profile with the keyboard still up", async () => {
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("profileStep")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("profileNameInput")).typeText("Keyboard Kid");
    await waitFor(element(by.id("profileHandleStatus")))
      .toHaveText("free")
      .withTimeout(10000);
    // The keyboard is still up (the name field still has it): Next is on screen above it.
    await expect(element(by.id("profileNameInput"))).toBeFocused();
    await expect(element(by.id("profileNext"))).toBeVisible();
    await element(by.id("profileNext")).tap();
    await waitFor(element(by.id("profileDone")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("profileDoneGreeting"))).toHaveText("Hi, Keyboard");
  });
});

describe("Next with the keyboard closed also makes the profile", () => {
  beforeAll(freshInstall);

  it("type a name, close the keyboard, Next", async () => {
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("profileStep")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("profileNameInput")).typeText("Closed Kid");
    await waitFor(element(by.id("profileHandleStatus")))
      .toHaveText("free")
      .withTimeout(10000);
    // A tap on the heading closes the keyboard.
    await element(by.text("Make your OGS profile")).tap();
    await expect(element(by.id("profileNameInput"))).not.toBeFocused();
    await expect(element(by.id("profileNext"))).toBeVisible();
    await element(by.id("profileNext")).tap();
    await waitFor(element(by.id("profileDone")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("profileDoneGreeting"))).toHaveText("Hi, Closed");
  });
});

describe("The profile step's return keys: name → @id → make the profile", () => {
  beforeAll(freshInstall);

  it("return on the name moves to the @id; return on the @id is Next", async () => {
    await element(by.id("onboardingSkipButton")).tap();
    await waitFor(element(by.id("profileStep")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("profileNameInput")).typeText("Return Kid");
    await element(by.id("profileNameInput")).tapReturnKey();
    await expect(element(by.id("profileHandleInput"))).toBeFocused();
    await waitFor(element(by.id("profileHandleStatus")))
      .toHaveText("free")
      .withTimeout(10000);
    await element(by.id("profileHandleInput")).tapReturnKey();
    await waitFor(element(by.id("profileDone")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("profileDoneGreeting"))).toHaveText("Hi, Return");
  });
});

describe("Sign in on a new phone restores the profile", () => {
  beforeAll(freshInstall);

  it("I already have a profile → email → the same @id, name and sticker", async () => {
    await element(by.id("onboardingSignInButton")).tap();
    await continueWithEmail(email);
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(10000);
    await element(by.id("tabProfile")).tap();
    await waitFor(element(by.id("profileHandle")))
      .toHaveText(`@${handle}`)
      .withTimeout(5000);
    await expect(element(by.id("profileName"))).toHaveText("Jonathan Mumm");
  });
});

describe("Signing in with a login no profile has", () => {
  beforeAll(freshInstall);

  it("offers to make a profile", async () => {
    await element(by.id("onboardingSignInButton")).tap();
    await continueWithEmail(uniqueEmail("nobody"));
    // The container is transparent (Detox's pixel check can't see it): its button can be seen.
    await waitFor(element(by.id("signInMakeProfile")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.text("No OGS profile has that login yet."))).toBeVisible();
    await element(by.id("signInMakeProfile")).tap();
    await waitFor(element(by.id("onboardingScreen")))
      .toExist()
      .withTimeout(5000);
  });
});

describe("A kid's iPad runs the same onboarding (Skip goes to the profile, not past it)", () => {
  beforeAll(freshInstall);

  it("Skip lands on the profile step; a grown-up types the name; no sign-in needed", async () => {
    await waitFor(element(by.id("onboardingSkipButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("onboardingSkipButton")).tap();
    await makeProfile("Juneau");
    await expect(element(by.id("profileDoneGreeting"))).toHaveText("Hi, Juneau");
    await element(by.id("onboardingLetsGoButton")).tap();
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(10000);
  });

  it("does not show onboarding on relaunch", async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(10000);
    await expect(element(by.id("onboardingScreen"))).not.toExist();
  });
});
