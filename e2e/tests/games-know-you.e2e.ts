// Slice 3 (games know who you are) on the iOS simulator: open Rocket Crew from the OGS app and it
// joins with the profile's name — no "Who's playing here?". The deployed game doesn't have this
// yet (no deploy), so the game runs locally and the API's catalogue points at it:
//
//   # OGS API copy (own D1, own port), Rocket Crew from the local server, local avatars
//   cd services/api && pnpm game-key   # once: OGS_GAME_SIGNING_KEY in .dev.vars
//   npx wrangler d1 execute opengame-api-db --local --persist-to <dir> --file=schema.sql
//   npx wrangler dev --port 8798 --enable-containers=false --persist-to <dir> \
//     --var 'CATALOGUE_START_URLS:{"rocket-crew":"http://localhost:8821/"}' --var AVATAR_BASE_URL:http://localhost:5180
//   # Rocket Crew verifying tokens with that API's key set
//   cd ~/src/rocket-crew && pnpm build:client && npx wrangler dev --port 8821 \
//     --var OGS_JWKS_URL:http://localhost:8798/.well-known/jwks.json
//   # Your own fake Chromecast (the TV), and a Release simulator build pointing at both
//   node e2e/fake-chromecast.mjs --port 5197
//   EXPO_PUBLIC_OGS_API=http://localhost:8798 EXPO_PUBLIC_FAKE_CAST=1 \
//     EXPO_PUBLIC_FAKE_CAST_URL=http://localhost:5197/load xcodebuild ... -derivedDataPath <dd>
//   E2E_IOS_DEVICE=<udid> pnpm --dir e2e e2e run tests/games-know-you.e2e.ts
import { describe, expect, test } from "e2e";

const GAME = process.env.ROCKET_URL ?? "http://localhost:8821";
const CAST = process.env.FAKE_CAST ?? "http://localhost:5197";
type Tv = { dom: { screen: string | null; frameApp: string | null } | null };
const tv = async (): Promise<Tv> => (await fetch(`${CAST}/launcher`)).json() as Promise<Tv>;

describe("Games know who you are", {
  tags: ["ios"],
  serial: true,
  requires: ["native-app"],
  video: "on",
}, () => {
  test("make a profile named Juneau", async ({ app, screen }) => {
    expect((await fetch(GAME)).ok).toBe(true);
    await app.clearState();
    await app.open();
    await screen.getByTestId("onboardingSkipButton").tap();
    await expect(screen.getByTestId("profileStep")).toBeVisible();
    await screen.getByTestId("profileNameInput").fill("Juneau");
    // A rerun gets a free "juneau2". Close the keyboard with its return key, then Next.
    await expect(screen.getByTestId("profileHandleStatus")).toHaveText("free", { timeout: 10_000 });
    await screen.getByTestId("profileNameInput").press("Enter");
    await screen.getByTestId("profileNext").tap();
    await expect(screen.getByTestId("profileDoneGreeting")).toHaveText("Hi, Juneau", {
      timeout: 10_000,
    });
    await screen.getByTestId("onboardingLetsGoButton").tap();
    await expect(screen.getByTestId("libraryScreen")).toBeVisible();
  });

  test("cast from the TV tab", async ({ screen }) => {
    await screen.getByTestId("tabTV").tap();
    await screen.getByTestId("castButton").tap();
    await expect(screen.getByTestId("remoteOk")).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await tv()).dom?.screen, { timeout: 20_000 }).toBe("home");
  });

  test("Rocket Crew from the app: no 'Who's playing here?', joined as Juneau", async ({
    app,
    screen,
  }) => {
    await screen.getByTestId("tabLibrary").tap();
    await screen.getByTestId("libraryGame-rocket-crew").tap();
    await expect(screen.getByTestId("gamePage")).toBeVisible();
    await screen.getByTestId("gamePlay").tap();
    await expect(screen.getByTestId("gameScreen")).toBeVisible();
    // The page joins with the profile's name from the OGS app (verified by the game's server).
    await expect(screen.getByText("Juneau", { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(screen.getByText("Who's playing here?")).toHaveCount(0);
    await app.screenshot("rocket-crew-joined-as-juneau");
    // Joined without typing: the game declared its TV page, which the launcher frames.
    await expect
      .poll(async () => (await tv()).dom?.frameApp, { timeout: 30_000 })
      .toBe("rocket-crew");
  });
});
