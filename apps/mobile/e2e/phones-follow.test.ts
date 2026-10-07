// Every couch phone follows the TV (docs/acceptance/2026-10-06-join-and-invite.feature): Mom's phone.
// Run by e2e/phones-follow.mjs, which casts the TV (a recorded launcher), plays Dad's phone (a
// scripted couch client plus Rocket Crew's phone page in a fake OGS WebView) and answers on
// MC_COORD: GET /wait/<step> blocks until the orchestrator (or this test) posts /step/<step>.
// Mom never taps the game: the couch session's follows move her phone.
// Needs a Release build with EXPO_PUBLIC_OGS_API = E2E_OGS_API.
import { by, device, element, expect, waitFor, web } from "detox";
import { skipOnboarding } from "./helpers";

const COORD = process.env.MC_COORD ?? "http://localhost:5291";

const str = (o: unknown, key: string): string => {
  const v =
    typeof o === "object" && o !== null && key in o
      ? Object.getOwnPropertyDescriptor(o, key)?.value
      : undefined;
  if (typeof v !== "string") throw new Error(`expected ${key}`);
  return v;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function step(name: string, body: unknown = {}): Promise<void> {
  await fetch(`${COORD}/step/${name}`, { method: "POST", body: JSON.stringify(body) });
}
/** Polls the orchestrator (each ask waits up to 20 s for the step; 204 = not yet). */
async function wait(name: string): Promise<unknown> {
  for (;;) {
    const res = await fetch(`${COORD}/wait/${name}`);
    if (res.status === 204) continue;
    if (!res.ok) throw new Error(`orchestrator: ${name} ${res.status}`);
    return res.json();
  }
}

/** The page the game's WebView shows now (its location after the game's own redirects). */
async function webViewUrl(match: RegExp): Promise<string> {
  let last = "";
  for (let i = 0; i < 60; i++) {
    try {
      const href: unknown = await web
        .element(by.web.tag("body"))
        .runScript("function (el) { return el.ownerDocument.location.href; }");
      last = typeof href === "string" ? href : "";
      if (match.test(last)) return last;
    } catch {
      // The page is still loading.
    }
    await sleep(500);
  }
  throw new Error(`the game's WebView never reached ${match} (last ${last})`);
}

async function inGame(): Promise<void> {
  await waitFor(element(by.id("gameScreen")))
    .toExist()
    .withTimeout(60000);
}
async function onRemote(): Promise<void> {
  await waitFor(element(by.id("gameScreen")))
    .not.toExist()
    .withTimeout(30000);
}

describe("Every couch phone follows the TV: Mom's phone", () => {
  jest.setTimeout(15 * 60 * 1000);

  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await skipOnboarding("Mom");
  });

  // One test: e2e/setup.ts reloads React Native before every test, which would close the game.
  it("joins the couch, follows Rocket Crew into the TV's room, steps out, and comes back with the TV", async () => {
    const code = str(await wait("code"), "code");
    await element(by.id("tabTV")).tap();
    // Join a TV sits under the Cast screen's TV list: swipe it into view.
    for (let i = 0; ; i++) {
      try {
        await waitFor(element(by.id("joinTvCode")))
          .toBeVisible()
          .withTimeout(1500);
        break;
      } catch (err) {
        if (i === 5) throw err;
        await element(by.id("tvNotCast")).swipe("up", "slow", 0.5);
      }
    }
    await element(by.id("joinTvCode")).typeText(code);
    await element(by.id("joinTvButton")).tap();
    await waitFor(element(by.id("tvRemote")))
      .toExist()
      .withTimeout(20000);
    await step("joined");

    // Dad started Rocket Crew, but its TV page hasn't named its room: Mom's phone waits.
    await wait("started-no-room");
    await sleep(4000);
    await expect(element(by.id("gameScreen"))).not.toExist();
    await step("still-remote");

    // The TV names its room: Mom's phone opens the game in it (start page + ogsRoom → /join/R).
    await inGame();
    const followed = await webViewUrl(/\/join\/[A-Z0-9]{4}/);
    await step("followed", { url: followed });
    await wait("seated");

    // Mom steps out to the remote: the TV keeps playing.
    try {
      await element(by.id("swipeHintOverlay")).swipe("right", "fast", 0.8, 0.02, 0.5);
    } catch {
      await element(by.id("gameScreen")).swipe("right", "fast", 0.8, 0.02, 0.5);
    }
    await onRemote();
    await step("stepped-out");

    // Dad presses Home, then Continue: Mom's phone follows back into the same room.
    await wait("continued");
    await inGame();
    const refollowed = await webViewUrl(/\/join\/[A-Z0-9]{4}/);
    await step("refollowed", { url: refollowed });

    // Home on the TV brings Mom's phone back to the remote.
    await wait("home");
    await onRemote();
    await expect(element(by.id("tvRemote"))).toExist();
    await step("home-done");
    await wait("done");
  });
});
