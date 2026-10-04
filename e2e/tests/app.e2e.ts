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
  test("first run: family step, then Library", async ({ app, screen }) => {
    await app.clearState();
    await app.open();
    await screen.getByTestId("onboardingNextButton").tap();
    await screen.getByTestId("familyNext").tap();
    await screen.getByTestId("onboardingLetsGoButton").tap();
    await expect(screen.getByTestId("libraryScreen")).toBeVisible();
    await expect(screen.getByTestId("tabPlaying")).toBeVisible();
    await expect(screen.getByTestId("tabTV")).toBeVisible();
    await expect(screen.getByTestId("tabLibrary")).toBeVisible();
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
    await screen.getByTestId("libraryGame-rocket-crew").tap();
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

  test("swap to Bake Shop: no recast", async ({ screen }) => {
    const loads = (await tv()).loads;
    await screen.getByTestId("libraryGame-bake-shop").tap();
    await expect(screen.getByTestId("gameScreen")).toBeVisible();
    await expect.poll(async () => (await tv()).dom?.screen, { timeout: 20_000 }).toBe("game");
    expect((await tv()).loads).toBe(loads);
  });
});
