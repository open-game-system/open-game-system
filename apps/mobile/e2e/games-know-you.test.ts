import { by, element, expect, waitFor } from "detox";
import { castSittings, freshLaunchWithOnboardingDone, until } from "./helpers";

// Slice 3 (games know who you are). Needs the local stack from e2e/tests/games-know-you.e2e.ts:
// a Release build with EXPO_PUBLIC_OGS_API pointing at an API copy whose CATALOGUE_START_URLS
// opens Rocket Crew from its local dev server (which verifies tokens with that API's JWKS).
// In the app the game gets the profile from the `profile` bridge store, joins without its name
// form, and reports its sitting over the `ogs` store: the game's page lists that sitting under
// its label ("Room KQTP" / "Mission 6"), not as a bare visit.
describe("Games know who you are", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("Rocket Crew joins as the profile and reports its sitting with a label", async () => {
    // A TV-required game starts once cast (EXPO_PUBLIC_FAKE_CAST=1: a fake Chromecast).
    await element(by.id("tabTV")).tap();
    await waitFor(element(by.id("castButton")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("castButton")).tap();
    await waitFor(element(by.id("remoteOk")))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("libraryGame-rocket-crew")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("libraryGame-rocket-crew")).tap();
    await waitFor(element(by.id("gamePlay")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("gamePlay")).tap();
    await waitFor(element(by.id("swipeHintOverlay")))
      .toBeVisible()
      .withTimeout(20000);
    // Give the page time to get its token, join and report (the hint covers it meanwhile).
    await new Promise((r) => setTimeout(r, 6000));
    await element(by.id("swipeHintOverlay")).swipe("right", "fast", 0.8, 0.02, 0.5);
    await waitFor(element(by.id("gamePage")))
      .toExist()
      .withTimeout(5000);
    // While cast, the game's report labels the couch's sitting (one start is one sitting,
    // ff994e63), so its id is the couch's, not `rocket-crew:<room>`. Detox on iOS matches ids and
    // text by name only (a RegExp reaches the app as a literal string): read the sitting from the
    // API, then find it on the page by its id and the game's own label.
    const label = /^(Room [A-Z]{4}|Mission \d+)$/;
    const reported = await until(
      () => castSittings("rocket-crew"),
      (list) => list.some((i) => label.test(i.title)),
      20000,
    );
    const sitting = reported.find((i) => label.test(i.title));
    if (!sitting) throw new Error(`no labelled Rocket Crew sitting: ${JSON.stringify(reported)}`);
    await waitFor(element(by.id(`gameSitting-${sitting.instanceId}`)))
      .toExist()
      .withTimeout(10000);
    await expect(element(by.text(sitting.title)).atIndex(0)).toExist();
  });
});
