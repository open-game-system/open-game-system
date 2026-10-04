import { by, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Spec v3, Getting back in: after swiping back from a game, a "Back in" return pill sits above
// the tabs on every tab. Replaces the Continue list (last 20 URLs), which spec v3 retires in
// favour of instances. Needs the local API (EXPO_PUBLIC_OGS_API) for the Library's games.
async function openFirstPhoneGame(): Promise<void> {
  await waitFor(element(by.id("libraryGame-rocket-crew")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("libraryGame-rocket-crew")).tap();
}

describe("Back in", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("a TV game tapped while not cast offers Cast to play", async () => {
    await openFirstPhoneGame();
    await waitFor(element(by.id("castToPlay")))
      .toBeVisible()
      .withTimeout(5000);
  });

  it("no return pill before any game was opened", async () => {
    await expect(element(by.id("returnPill"))).not.toExist();
  });
});
