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

  // Owner, 2026-10-04: Library is the games you have; "+ Add games" is gone (a developer setting
  // will add your own game later). A tap opens the game's page.
  it("Library lists games, with no + Add games; a tap opens the game's page", async () => {
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("libraryGame-rocket-crew")))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id("addGames"))).not.toExist();
    await element(by.id("libraryGame-rocket-crew")).tap();
    await waitFor(element(by.id("gamePage")))
      .toExist()
      .withTimeout(3000);
    await element(by.id("gamePageBack")).tap();
    await waitFor(element(by.id("libraryScreen")))
      .toExist()
      .withTimeout(3000);
  });

  // Friends slice 2 (docs/acceptance/2026-10-04-ogs-friends.feature) replaced the pre-backend
  // "Share my profile" empty state with Add a friend.
  it("Friends with no friends yet offers Add a friend", async () => {
    await element(by.id("tabFriends")).tap();
    await waitFor(element(by.id("friendsScreen")))
      .toExist()
      .withTimeout(3000);
    // The empty state is a transparent container (Detox's pixel visibility can't see it): check
    // that it exists and that its heading and button show.
    await waitFor(element(by.id("friendsEmpty")))
      .toExist()
      .withTimeout(5000);
    await expect(element(by.text("Play with friends"))).toBeVisible();
    await expect(element(by.id("addFriend"))).toBeVisible();
    await expect(element(by.id("shareProfile"))).not.toExist();
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
