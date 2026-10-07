import { by, element, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Owner, 2026-10-05 (real iPhone, two Chromecasts): "when i tap the other device sometimes it
// works and sometimes it doesn't… sometimes it eventually works". Google Cast refuses a new
// session while the old one is still ending; the app now waits for it to end.
// Acceptance: docs/acceptance/2026-10-05-tv-switching.feature.
//
// Needs two fake Chromecasts and a build that uses them with Cast's real end timing:
//   cd e2e && node fake-chromecast.mjs --port 5181 & node fake-chromecast.mjs --port 5182 &
//   EXPO_PUBLIC_FAKE_CAST=2 EXPO_PUBLIC_FAKE_CAST_URL=http://localhost:5181/load
//   EXPO_PUBLIC_FAKE_CAST_URL_2=http://localhost:5182/load EXPO_PUBLIC_FAKE_CAST_END_MS=1500
// (plus EXPO_PUBLIC_OGS_API / EXPO_PUBLIC_OGS_TV like every Detox run; see docs/testing/e2e.md).
const LIVING = { id: "fake-living-room", url: process.env.FAKE_CAST ?? "http://localhost:5181" };
const BEDROOM = { id: "fake-bedroom", url: process.env.FAKE_CAST_2 ?? "http://localhost:5182" };

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

async function until(ok: () => Promise<boolean>, what: string, ms = 20000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ok()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${what}`);
}

describe("Switching TVs (two Chromecasts)", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("10 alternating switches: every one ends framed on the picked TV, the other stopped", async () => {
    await element(by.id("tabTV")).tap();
    try {
      await waitFor(element(by.id(`castChoice-${LIVING.id}`)))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id(`castChoice-${LIVING.id}`)).tap();
      await element(by.id("castButton")).tap();
    } catch {
      // Already cast (the session survived setup's reload): the remote is up.
    }
    await waitFor(element(by.id("tvRemote")))
      .toBeVisible()
      .withTimeout(20000);
    await until(async () => (await status(LIVING)).viewUrl !== null, "Living room TV framed");

    for (let i = 0; i < 10; i++) {
      const [to, from] = i % 2 === 0 ? [BEDROOM, LIVING] : [LIVING, BEDROOM];
      await element(by.id("tvPickerOpen")).tap();
      await waitFor(element(by.id(`tvPickerDevice-${to.id}`)))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id(`tvPickerDevice-${to.id}`)).tap();
      // The picker closes once the new TV is connected; a failure would leave it open, with its error.
      await waitFor(element(by.id("tvPicker")))
        .not.toBeVisible()
        .withTimeout(30000);
      await until(
        async () => (await status(to)).viewUrl !== null && (await status(from)).viewUrl === null,
        `switch ${i + 1}: ${to.id} framed, ${from.id} stopped`,
      );
      await waitFor(element(by.id("tvRemote")))
        .toBeVisible()
        .withTimeout(10000);
    }
  });
});
