import { by, device, element, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Owner, 2026-10-05 (real iPhone, two Chromecasts): "when i tap the other device sometimes it
// works and sometimes it doesn't… sometimes it eventually works". Google Cast refuses a new
// session while the old one is still ending; the app now waits for it to end.
// Owner, 2026-10-06: after a switch the TV tab's hero (and the TV's header) still named the old
// TV, and mid-switch the "Cast to" sheet felt dead. Now the sheet closes at the tap, the hero says
// "Switching to <TV>…" then names the new TV, the couch session is renamed (tv.rename) so the
// launcher's header follows, and a TV tapped mid-switch wins.
// Acceptance: docs/acceptance/2026-10-05-tv-switching.feature.
//
// Needs two fake Chromecasts and a build that uses them with Cast's asynchronous end (slow enough
// that the sheet can be reopened mid-switch):
//   cd e2e && node fake-chromecast.mjs --port 5181 & node fake-chromecast.mjs --port 5182 &
//   EXPO_PUBLIC_FAKE_CAST=2 EXPO_PUBLIC_FAKE_CAST_URL=http://localhost:5181/load
//   EXPO_PUBLIC_FAKE_CAST_URL_2=http://localhost:5182/load EXPO_PUBLIC_FAKE_CAST_END_MS=3000
// (plus EXPO_PUBLIC_OGS_API / EXPO_PUBLIC_OGS_TV like every Detox run, E2E_OGS_API; see
// docs/testing/e2e.md).
type Tv = { id: string; name: string; url: string };
const LIVING: Tv = {
  id: "fake-living-room",
  name: "Living room TV",
  url: process.env.FAKE_CAST ?? "http://localhost:5181",
};
const BEDROOM: Tv = {
  id: "fake-bedroom",
  name: "Bedroom TV",
  url: process.env.FAKE_CAST_2 ?? "http://localhost:5182",
};

type Status = { loads: number; viewUrl: string | null };
const status = async (tv: { url: string }): Promise<Status> => {
  const body: unknown = await (await fetch(`${tv.url}/status`)).json();
  if (typeof body !== "object" || body === null || !("loads" in body) || !("viewUrl" in body))
    throw new Error(`not a fake Chromecast status: ${JSON.stringify(body)}`);
  return {
    loads: typeof body.loads === "number" ? body.loads : 0,
    viewUrl: typeof body.viewUrl === "string" ? body.viewUrl : null,
  };
};

/** The launcher's header on that fake TV ("<TV> · <host>'s games"), or null. */
const roomName = async (tv: { url: string }): Promise<string | null> => {
  const body: unknown = await (await fetch(`${tv.url}/launcher`)).json();
  if (typeof body !== "object" || body === null || !("dom" in body)) return null;
  const dom = body.dom;
  if (typeof dom !== "object" || dom === null || !("roomName" in dom)) return null;
  return typeof dom.roomName === "string" ? dom.roomName : null;
};

async function until(ok: () => Promise<boolean>, what: string, ms = 20000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** The sheet's slide in or out, while Detox isn't waiting for animations (synchronization off). */
const SHEET_SETTLE_MS = 350;

/** Taps Change TV; the sheet that just closed may still cover it for a moment (sync off). */
async function openPicker() {
  for (let tries = 0; ; tries++) {
    try {
      await element(by.id("tvPickerOpen")).tap();
      return;
    } catch (err) {
      if (tries >= 10) throw err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

/**
 * Opens "Cast to" and taps the TV: the sheet closes at the tap. Detox's synchronization is off
 * from here until landedOn: with it on, every action and check waits for the app to be idle, i.e.
 * for the switch to be over (the tap itself only returns then), so "Switching to <TV>…" and a
 * reopen mid-switch could never be seen. Without it, the sheet's slide in and out are waited out
 * by hand (openPicker's retries, a short settle).
 */
async function pickTv(tv: Tv, opts: { midSwitchTo?: Tv; reopenNext?: boolean } = {}) {
  await device.disableSynchronization();
  await openPicker();
  await waitFor(element(by.id(`tvPickerDevice-${tv.id}`)))
    .toBeVisible()
    .withTimeout(10000);
  if (opts.midSwitchTo) {
    // Still switching: the sheet's row for that TV says so (the other rows stay tappable).
    await waitFor(element(by.id(`tvPickerStatus-${opts.midSwitchTo.id}`)))
      .toHaveText(`Switching to ${opts.midSwitchTo.name}…`)
      .withTimeout(1000);
  }
  // Visible already counts mid slide-in; a tap then can miss the row. The hero says what is
  // happening at once (the old TV is still ending); if it doesn't, the tap missed: tap again (the
  // same TV twice is one switch).
  await new Promise((r) => setTimeout(r, SHEET_SETTLE_MS));
  for (let tries = 0; ; tries++) {
    await element(by.id(`tvPickerDevice-${tv.id}`)).tap();
    try {
      await heroSwitchingTo(tv);
      break;
    } catch (err) {
      if (tries >= 2) throw err;
    }
  }
  // Reopening at once instead: the switch must still be running then (openPicker waits out the
  // sheet's slide-out).
  if (opts.reopenNext) return;
  await waitFor(element(by.id("tvPicker")))
    .not.toBeVisible()
    .withTimeout(3000);
}

/** The switch ended on `to`: framed there, `from` stopped, the hero and the TV's header name it. */
async function landedOn(to: Tv, from: Tv, what: string) {
  await until(
    async () => (await status(to)).viewUrl !== null && (await status(from)).viewUrl === null,
    `${what}: ${to.id} framed, ${from.id} stopped`,
  );
  await waitFor(element(by.id("remoteTvName")))
    .toBeVisible()
    .withTimeout(10000);
  await waitFor(element(by.id("remoteTvName")))
    .toHaveText(to.name)
    .withTimeout(20000);
  await until(
    async () => (await roomName(to))?.startsWith(`${to.name} · `) === true,
    `${what}: the launcher on ${to.id} names ${to.name}`,
  );
  await device.enableSynchronization();
}

/** The hero says "Switching to <TV>…" (polled: synchronization is off mid-switch). */
async function heroSwitchingTo(tv: Tv) {
  await waitFor(element(by.id("remoteTvName")))
    .toHaveText(`Switching to ${tv.name}…`)
    .withTimeout(1500);
}

describe("Switching TVs (two Chromecasts)", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  // One test: setup reloads the JS before each test, and the fake Cast session lives in JS (a real
  // phone keeps its native Cast session across a reload), so a second test would start with the
  // couch still cast but no Cast session to end, and its first switch would be instant.
  it("10 alternating switches, then a change of mind mid-switch: each ends framed on the TV tapped last, named on the phone and the TV", async () => {
    await element(by.id("tabTV")).tap();
    await waitFor(element(by.id("castButton")))
      .toBeVisible()
      .withTimeout(10000);
    // With both TVs found the tab asks which; with only the first found yet, Cast goes to it.
    const choosing = await element(by.id(`castChoice-${LIVING.id}`))
      .getAttributes()
      .then(
        () => true,
        () => false,
      );
    if (choosing) await element(by.id(`castChoice-${LIVING.id}`)).tap();
    await element(by.id("castButton")).tap();
    await waitFor(element(by.id("remoteTvName")))
      .toBeVisible()
      .withTimeout(20000);
    await until(async () => (await status(LIVING)).viewUrl !== null, "Living room TV framed");

    for (let i = 0; i < 10; i++) {
      const [to, from] = i % 2 === 0 ? [BEDROOM, LIVING] : [LIVING, BEDROOM];
      await pickTv(to);
      await landedOn(to, from, `switch ${i + 1}`);
    }

    // Changing your mind: tap Bedroom TV, reopen the sheet while it switches, tap Living room TV.
    await pickTv(BEDROOM, { reopenNext: true });
    await pickTv(LIVING, { midSwitchTo: BEDROOM });
    await landedOn(LIVING, BEDROOM, "changed mind");
    // And it stays there: the superseded switch doesn't come back.
    await new Promise((r) => setTimeout(r, 3000));
    const [bedroom, living] = [await status(BEDROOM), await status(LIVING)];
    if (bedroom.viewUrl !== null || living.viewUrl === null)
      throw new Error(`moved off Living room TV: ${JSON.stringify({ bedroom, living })}`);
    await waitFor(element(by.id("remoteTvName")))
      .toHaveText(LIVING.name)
      .withTimeout(1000);
  }, 300_000);
});
