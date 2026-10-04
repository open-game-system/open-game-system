// The OGS app on the iOS simulator (Release build with EXPO_PUBLIC_FAKE_CAST=1) against the local
// API, with the fake Chromecast as the TV. Proves spec v3 from the phone: Cast once from the TV tab,
// a game launched from Library frames on the TV with no recast, the left-edge swipe back pauses it
// on the TV, and a swap never recasts. Deterministic: locators + the fake Chromecast's /launcher probe.
import { describe, expect, test } from "e2e";

const CAST = process.env.FAKE_CAST ?? "http://localhost:5181";
type Tv = {
  loads: number;
  dom: {
    screen: string | null;
    frameApp: string | null;
    frameSrc: string | null;
    starting: boolean;
    continueApps: string[];
  } | null;
};
const tv = async (): Promise<Tv> => (await fetch(`${CAST}/launcher`)).json() as Promise<Tv>;
/** The Rocket Crew room the TV frames: its TV page is /tv/<CODE>. */
const tvRoom = async (): Promise<string | null> => (await tv()).dom?.frameSrc?.match(/\/tv\/([A-Z]{4})/)?.[1] ?? null;

describe("OGS app, cast-first", { tags: ["ios"], serial: true, requires: ["native-app"], video: "on" }, () => {
  test("first run: make your OGS profile, then Library", async ({ app, screen }) => {
    await app.clearState();
    await app.open();
    // Skip the intro (never the profile): "Make your OGS profile", name typed, @id pre-filled.
    await screen.getByTestId("onboardingSkipButton").tap();
    await expect(screen.getByTestId("profileStep")).toBeVisible();
    await expect(screen.getByText("Who's in your family?")).toHaveCount(0);
    await screen.getByTestId("profileNameInput").fill("Jonathan Mumm");
    await expect(screen.getByTestId("profileHandleStatus")).toHaveText("free", { timeout: 10_000 });
    // Next stays above the keyboard: tap it with the keyboard still up.
    await expect(screen.getByTestId("profileNext")).toBeVisible();
    await screen.getByTestId("profileNext").tap();
    // The done page greets by first name and offers Back up (never required) and Let's go.
    await expect(screen.getByTestId("profileDoneGreeting")).toHaveText("Hi, Jonathan", { timeout: 10_000 });
    // "@jonathan.m", or a free variant when an earlier run already took it.
    await expect(screen.getByTestId("profileDoneHandle")).toHaveText(/^@jonathan\.m\d*$/);
    await expect(screen.getByTestId("profileDoneBackUp")).toBeVisible();
    await app.screenshot("profile-done");
    await screen.getByTestId("onboardingLetsGoButton").tap();
    await expect(screen.getByTestId("libraryScreen")).toBeVisible();
    await expect(screen.getByTestId("tabPlaying")).toBeVisible();
    await expect(screen.getByTestId("tabTV")).toBeVisible();
    await expect(screen.getByTestId("tabLibrary")).toBeVisible();
    await expect(screen.getByTestId("tabFriends")).toBeVisible();
    await expect(screen.getByTestId("tabProfile")).toBeVisible();
    await app.screenshot("library");
  });

  test("Cast from the TV tab loads the launcher once; the tab becomes the remote", async ({ app, screen }) => {
    const before = (await tv()).loads;
    await screen.getByTestId("tabTV").tap();
    await screen.getByTestId("castButton").tap();
    await expect(screen.getByTestId("remoteOk")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await tv()).dom?.screen, { timeout: 20_000 }).toBe("home");
    expect((await tv()).loads).toBe(before + 1);
    await app.screenshot("remote");
  });

  test("a game from Library: the TV waits, then frames the game once its page declares a TV view", async ({ app, screen }) => {
    const loads = (await tv()).loads;
    await screen.getByTestId("tabLibrary").tap();
    // A Library tap opens the game's page; New game starts it.
    await screen.getByTestId("libraryGame-rocket-crew").tap();
    await expect(screen.getByTestId("gamePage")).toBeVisible();
    await screen.getByTestId("gameNew").tap();
    await expect(screen.getByTestId("gameScreen")).toBeVisible();
    await expect.poll(async () => (await tv()).dom?.starting, { timeout: 20_000 }).toBe(true);
    // Rocket Crew declares its TV page once the host has a crew name.
    await screen.getByText("Name", { exact: false }).first().tap();
    await screen.getByText("Name", { exact: false }).first().fill("Dad");
    await screen.getByText("JOIN", { exact: false }).first().tap();
    await expect.poll(async () => (await tv()).dom?.frameApp, { timeout: 30_000 }).toBe("rocket-crew");
    expect((await tv()).loads).toBe(loads);
    await app.screenshot("rocket-crew-host");
  });

  test("swipe back from the left edge: home on the TV with Rocket Crew paused", async ({ app, screen }) => {
    await screen.swipe({ from: { x: 10, y: 450 }, to: { x: 340, y: 450 } });
    // Back on the game's page, which now lists the sitting with its Rejoin.
    await expect(screen.getByTestId("gamePage")).toBeVisible();
    await expect(screen.getByTestId(/^gameSittingRejoin-/)).toHaveCount(1);
    await screen.getByTestId("gamePageBack").tap();
    await expect(screen.getByTestId("libraryScreen")).toBeVisible();
    await expect.poll(async () => (await tv()).dom?.screen, { timeout: 15_000 }).toBe("home");
    await expect.poll(async () => (await tv()).dom?.continueApps ?? [], { timeout: 15_000 }).toContain("game:rocket-crew");
    await app.screenshot("back-in-library");
  });

  test("Rejoin from the pill returns to the same Rocket Crew room, still framed on the TV", async ({ app, screen }) => {
    const loads = (await tv()).loads;
    const rejoin = async () => {
      await expect(screen.getByTestId("returnPill")).toBeVisible();
      await screen.getByTestId("returnPill").tap();
      await expect(screen.getByTestId("gameScreen")).toBeVisible();
      await expect.poll(async () => (await tv()).dom?.screen, { timeout: 20_000 }).toBe("game");
      await expect.poll(tvRoom, { timeout: 20_000 }).toMatch(/^[A-Z]{4}$/);
      const room = (await tvRoom()) ?? "";
      // The Captain's lobby shows the room's code for the Fixer, and the seat is kept (no name
      // prompt): the host is back in the room it made, not a fresh one.
      await expect(screen.getByText(room, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
      await expect(screen.getByText("Name", { exact: false })).toHaveCount(0);
      return room;
    };
    const backOut = async () => {
      await screen.swipe({ from: { x: 10, y: 450 }, to: { x: 340, y: 450 } });
      await expect(screen.getByTestId("libraryScreen")).toBeVisible();
      await expect.poll(async () => (await tv()).dom?.screen, { timeout: 15_000 }).toBe("home");
    };
    const first = await rejoin();
    await app.screenshot("rejoin-same-room");
    await backOut();
    expect(await rejoin()).toBe(first);
    expect((await tv()).loads).toBe(loads);
    await backOut();
  });

  test("a New game of Rocket Crew from its page: the page lists two sittings, each with Rejoin", async ({ app, screen }) => {
    await screen.getByTestId("tabLibrary").tap();
    await screen.getByTestId("libraryGame-rocket-crew").tap();
    await expect(screen.getByTestId("gamePage")).toBeVisible();
    await expect(screen.getByTestId(/^gameSittingRejoin-/)).toHaveCount(1);
    await screen.getByTestId("gameNew").tap();
    await expect(screen.getByTestId("gameScreen")).toBeVisible();
    await expect.poll(async () => (await tv()).dom?.screen, { timeout: 20_000 }).toBe("game");
    await screen.swipe({ from: { x: 10, y: 450 }, to: { x: 340, y: 450 } });
    await expect(screen.getByTestId("gamePage")).toBeVisible();
    await expect(screen.getByTestId(/^gameSittingRejoin-/)).toHaveCount(2, { timeout: 15_000 });
    await app.screenshot("game-page-two-sittings");
    await screen.getByTestId("gamePageBack").tap();
    await expect(screen.getByTestId("libraryScreen")).toBeVisible();
  });

  test("swap to Bake Shop: no recast", async ({ screen }) => {
    const loads = (await tv()).loads;
    await screen.getByTestId("libraryGame-bake-shop").tap();
    await expect(screen.getByTestId("gamePage")).toBeVisible();
    await screen.getByTestId("gameNew").tap();
    await expect(screen.getByTestId("gameScreen")).toBeVisible();
    await expect.poll(async () => (await tv()).dom?.screen, { timeout: 20_000 }).toBe("game");
    expect((await tv()).loads).toBe(loads);
  });
});
