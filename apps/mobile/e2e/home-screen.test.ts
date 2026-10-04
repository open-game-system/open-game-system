import { by, device, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// App structure: five tabs (Playing · TV · Library · Friends · Profile), always all five (owner
// decision, Oct 2026; was three in spec v3). Supersedes the single-scroll home screen (Continue +
// Game Directory) of 2026-03-15-ogs-app-home-screen.feature.
describe("Tabs", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("opens on Library when nothing is live", async () => {
    await expect(element(by.id("libraryScreen"))).toExist();
  });

  it("shows Playing, TV, Library, Friends and Profile", async () => {
    await expect(element(by.id("tabPlaying"))).toBeVisible();
    await expect(element(by.id("tabTV"))).toBeVisible();
    await expect(element(by.id("tabLibrary"))).toBeVisible();
    await expect(element(by.id("tabFriends"))).toBeVisible();
    await expect(element(by.id("tabProfile"))).toBeVisible();
  });

  it("TV shows one big Cast button before casting", async () => {
    await element(by.id("tabTV")).tap();
    await waitFor(element(by.id("castButton")))
      .toBeVisible()
      .withTimeout(3000);
  });

  it("Playing is never a dead end", async () => {
    await element(by.id("tabPlaying")).tap();
    await waitFor(element(by.id("playingScreen")))
      .toExist()
      .withTimeout(3000);
  });

  it("Library offers + Add games", async () => {
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("addGames")))
      .toBeVisible()
      .whileElement(by.id("libraryScreen"))
      .scroll(300, "down");
  });

  it("Friends is honestly empty, with Share my profile", async () => {
    await element(by.id("tabFriends")).tap();
    await waitFor(element(by.id("friendsScreen")))
      .toExist()
      .withTimeout(3000);
    await expect(element(by.id("friendsEmpty"))).toBeVisible();
    await expect(element(by.id("shareProfile"))).toBeVisible();
  });

  it("Profile shows you, and opens settings", async () => {
    await element(by.id("tabProfile")).tap();
    await waitFor(element(by.id("profileScreen")))
      .toExist()
      .withTimeout(3000);
    await expect(element(by.id("profileName"))).toBeVisible();
    await waitFor(element(by.id("profileSettings")))
      .toBeVisible()
      .whileElement(by.id("profileScreen"))
      .scroll(200, "down");
    await element(by.id("profileSettings")).tap();
    await waitFor(element(by.id("settingsScreen")))
      .toExist()
      .withTimeout(3000);
    await element(by.id("settingsCloseButton")).tap();
    await waitFor(element(by.id("profileScreen")))
      .toExist()
      .withTimeout(3000);
  });

  it("opens on Library again on a cold start", async () => {
    await device.launchApp({ newInstance: true });
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(8000);
  });
});
