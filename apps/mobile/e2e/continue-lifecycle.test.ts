import { by, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Spec v3, Getting back in: after swiping back from a game, a "Rejoin" return pill sits above
// the tabs on TV, Friends and Profile (owner, 2026-10-04). Replaces the Continue list (last 20 URLs), which spec v3 retires in
// favour of instances. Needs the local API (EXPO_PUBLIC_OGS_API) for the Library's games.
async function openRocketCrewPage(): Promise<void> {
  await waitFor(element(by.id("libraryGame-rocket-crew")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("libraryGame-rocket-crew")).tap();
  await waitFor(element(by.id("gamePage")))
    .toExist()
    .withTimeout(3000);
}

describe("Rejoin", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  // Owner, 2026-10-04: the CTA is Play, never "Cast to play"; Play asks to cast (play-cta.test.ts).
  it("a TV game's page offers Play (not Start game, not Cast to play) while not cast", async () => {
    await openRocketCrewPage();
    await waitFor(element(by.id("gamePlay")))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id("gameNew"))).not.toExist();
    await expect(element(by.text("Cast to play"))).not.toExist();
    await element(by.id("gamePageBack")).tap();
  });

  it("no return pill before any game was opened", async () => {
    // On the tabs that would show it (owner, 2026-10-04: TV, Friends and Profile).
    for (const tab of ["tabTV", "tabFriends", "tabProfile"]) {
      await element(by.id(tab)).tap();
      await expect(element(by.id("returnPill"))).not.toExist();
    }
  });
});
