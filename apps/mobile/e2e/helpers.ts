import { by, device, element, waitFor } from "detox";

/**
 * Sign-in codes: the local API (`wrangler dev`) captures what the Cloudflare Email Service binding
 * sends and lists it in its Local Explorer, which only answers on localhost. E2E_OGS_API is the API
 * the app was built against (EXPO_PUBLIC_OGS_API is baked in at build time); the test reads the
 * capture from Node at that API's port.
 */
const SENT_EMAILS = (() => {
  const url = new URL(
    "/cdn-cgi/local/explorer/api/local/email/sending?per_page=100",
    process.env.E2E_OGS_API ?? "http://localhost:8788",
  );
  url.hostname = "localhost";
  return url.href;
})();

/** A fresh address per run, so a backed-up login never collides with an earlier run's. */
export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}@example.com`;

/** The 6-digit code in the newest email to `email` sent at or after `since` (polls briefly). */
export async function emailCode(email: string, since: number): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(SENT_EMAILS);
    const body: unknown = await res.json();
    const list: unknown[] =
      typeof body === "object" && body !== null && "result" in body && Array.isArray(body.result)
        ? body.result
        : [];
    let best: { at: number; code: string } | null = null;
    for (const mail of list) {
      if (typeof mail !== "object" || mail === null) continue;
      const to = "to" in mail ? mail.to : null;
      const subject = "subject" in mail ? mail.subject : null;
      const sent = "sentAt" in mail ? mail.sentAt : null;
      if (!Array.isArray(to) || !to.includes(email) || typeof subject !== "string") continue;
      const at = typeof sent === "string" ? Date.parse(sent) : 0;
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

/** Back up / sign in with email: address, then the code the local API's email binding sent. */
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
