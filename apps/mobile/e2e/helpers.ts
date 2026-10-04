import { by, device, element, waitFor } from "detox";

/**
 * The emulated Resend inbox (vercel-labs/emulate) the e2e API sends sign-in codes to.
 * EXPO_PUBLIC_* are baked into the app at build time; the test reads the inbox from Node.
 */
const INBOX = process.env.E2E_RESEND_INBOX ?? "http://localhost:4108/emails";

/** A fresh address per run, so a backed-up login never collides with an earlier run's. */
export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`;

/** The 6-digit code in the newest email to `email` sent at or after `since` (polls briefly). */
export async function emailCode(email: string, since: number): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(INBOX, { headers: { Authorization: "Bearer e2e" } });
    const body: unknown = await res.json();
    const list: unknown[] =
      typeof body === "object" && body !== null && "data" in body && Array.isArray(body.data)
        ? body.data
        : [];
    let best: { at: number; code: string } | null = null;
    for (const mail of list) {
      if (typeof mail !== "object" || mail === null) continue;
      const to = "to" in mail ? mail.to : null;
      const subject = "subject" in mail ? mail.subject : null;
      const created = "created_at" in mail ? mail.created_at : null;
      if (!Array.isArray(to) || !to.includes(email) || typeof subject !== "string") continue;
      const at = typeof created === "string" ? Date.parse(created) : 0;
      const code = subject.match(/\b(\d{6})\b/)?.[1];
      if (code && at >= since - 2000 && (!best || at > best.at)) best = { at, code };
    }
    if (best) return best.code;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in code reached ${email}`);
}

/** Type into a field and close the keyboard with its return key. */
async function typeAndReturn(id: string, text: string): Promise<void> {
  await element(by.id(id)).typeText(text);
  await element(by.id(id)).tapReturnKey();
}

/** Onboarding's profile step: type a name, wait for the @id, Next, then Let's go. */
export async function makeProfile(name: string): Promise<void> {
  await waitFor(element(by.id("profileStep")))
    .toBeVisible()
    .withTimeout(10000);
  await typeAndReturn("profileNameInput", name);
  await waitFor(element(by.id("profileHandleStatus")))
    .toHaveText("free")
    .withTimeout(10000);
  await waitFor(element(by.id("profileNext")))
    .toBeVisible()
    .whileElement(by.id("profileStep"))
    .scroll(150, "down");
  await element(by.id("profileNext")).tap();
  await waitFor(element(by.id("profileDone")))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Get past onboarding: skip the intro, make a profile, Let's go. Call before tests that need the
 * Library. A device that already has a profile is left as it is.
 */
export async function skipOnboarding(name = "Tester"): Promise<void> {
  try {
    await waitFor(element(by.id("onboardingSkipButton")))
      .toBeVisible()
      .withTimeout(5000);
  } catch {
    return; // Already past onboarding
  }
  await element(by.id("onboardingSkipButton")).tap();
  await makeProfile(name);
  await element(by.id("onboardingLetsGoButton")).tap();
  await waitFor(element(by.id("libraryScreen")))
    .toExist()
    .withTimeout(10000);
}

/** Back up / sign in with email: address, then the code from the emulated inbox. */
export async function continueWithEmail(email: string): Promise<void> {
  await waitFor(element(by.id("signInScreen")))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id("signInEmail")).tap();
  await typeAndReturn("signInEmailInput", email);
  const since = Date.now();
  await element(by.id("signInSendCode")).tap();
  await waitFor(element(by.id("signInCodeInput")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("signInCodeInput")).typeText(await emailCode(email, since));
  await element(by.id("signInVerify")).tap();
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
