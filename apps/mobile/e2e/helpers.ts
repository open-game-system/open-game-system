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

/** The fake Chromecasts (one per TV a FAKE_CAST=2 build finds); a cast goes to one of them. */
const CASTS = [
  process.env.FAKE_CAST ?? "http://localhost:5181",
  process.env.FAKE_CAST_2 ?? "http://localhost:5182",
];

async function getJson(url: string, token?: string): Promise<unknown> {
  const res = await fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

/**
 * The host's sittings of one game, from the API (E2E_OGS_API), read with the launcher token of the
 * TV cast last (it acts for its host; the other fake TV may still show an earlier run's profile).
 * Detox on iOS matches ids by name only, so tests find a sitting's id here first.
 */
export async function castSittings(
  appId: string,
): Promise<{ instanceId: string; title: string }[]> {
  let token: string | null = null;
  let latest = 0;
  for (const cast of CASTS) {
    const s = await getJson(`${cast}/status`).catch(() => null);
    if (typeof s !== "object" || s === null || !("viewUrl" in s) || !("startedAt" in s)) continue;
    const { viewUrl, startedAt } = s;
    if (typeof viewUrl !== "string" || typeof startedAt !== "number" || startedAt <= latest)
      continue;
    latest = startedAt;
    token = new URL(viewUrl).searchParams.get("token");
  }
  if (!token) throw new Error("no fake Chromecast has a launcher token");
  const all = await getJson(
    new URL("/api/v1/me/instances", process.env.E2E_OGS_API ?? "http://localhost:8788").href,
    token,
  );
  if (!Array.isArray(all)) throw new Error("instances: not a list");
  return all.flatMap((i: unknown) =>
    typeof i === "object" &&
    i !== null &&
    "appId" in i &&
    i.appId === appId &&
    "instanceId" in i &&
    typeof i.instanceId === "string" &&
    "title" in i &&
    typeof i.title === "string"
      ? [{ instanceId: i.instanceId, title: i.title }]
      : [],
  );
}

/** Poll `read` until `ok` or `ms` pass; returns the last read. */
export async function until<T>(
  read: () => Promise<T>,
  ok: (v: T) => boolean,
  ms: number,
): Promise<T> {
  const end = Date.now() + ms;
  let last = await read();
  while (!ok(last) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    last = await read();
  }
  return last;
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
  // The done page: its greeting (the page view itself, mostly a picture of a TV and empty dusk,
  // fails Detox's 75% pixel check though it is on screen).
  await waitFor(element(by.id("profileDoneGreeting")))
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

/**
 * Back up / sign in with email: address, then the code the local API's email binding sent. Email is
 * the only way in, so the sheet opens on the address field (no "Continue with email" tap).
 */
export async function continueWithEmail(email: string): Promise<void> {
  // The sheet's root is transparent (Detox's pixel check can't see it on an SE): its field can.
  await waitFor(element(by.id("signInEmailInput")))
    .toBeVisible()
    .withTimeout(5000);
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

/**
 * On a game's page, start a game: Play when it lists no sittings, else Start game. Cast already,
 * so neither asks to cast first.
 */
export async function startFromGamePage(): Promise<void> {
  await waitFor(element(by.id("gamePage")))
    .toExist()
    .withTimeout(5000);
  try {
    await waitFor(element(by.id("gamePlay")))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.id("gamePlay")).tap();
  } catch {
    await element(by.id("gameNew")).tap();
  }
}
