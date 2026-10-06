import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { by, device, element, expect, waitFor } from "detox";
import { freshLaunchWithOnboardingDone } from "./helpers";

// Owner, 2026-10-05: "when i was testing joining story nook i think it joined for me twice? because
// it created two games at the same minute". Starting a game while cast opens the couch session's
// sitting (`story-nook-<time>`); the game's phone page reported its room under its own id
// (`story-nook:XJNE`), so the game's page listed two sittings, both "Room XJNE", both "Just now".
// Needs the local API (E2E_OGS_API = the build's EXPO_PUBLIC_OGS_API) with Story Nook's start page
// local (CATALOGUE_START_URLS), the launcher, and a fake Chromecast (FAKE_CAST, the build's
// EXPO_PUBLIC_FAKE_CAST=2 and EXPO_PUBLIC_FAKE_CAST_URL=$FAKE_CAST/load). See docs/testing/e2e.md.
const CAST = process.env.FAKE_CAST ?? "http://localhost:5181";
const API = process.env.E2E_OGS_API ?? "http://localhost:8788";

type Tv = { dom: { frameApp: string | null } | null };
type Status = { viewUrl: string | null };
type Sitting = { instanceId: string; appId: string; title?: string; label?: string };

const json = async <T>(url: string, token?: string): Promise<T> => {
  const res = await fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
};

/** E2E_SHOTS: a folder to copy the screenshots into. */
async function shot(name: string): Promise<void> {
  const path = await device.takeScreenshot(name);
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  copyFileSync(path, join(dir, `${name}.png`));
}

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms: number): Promise<T> {
  const end = Date.now() + ms;
  let last = await read();
  while (!ok(last) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    last = await read();
  }
  return last;
}

/** The host's Story Nook instances, read with the TV's launcher token (it acts for its host). */
async function storyNookInstances(): Promise<Sitting[]> {
  const { viewUrl } = await json<Status>(`${CAST}/status`);
  const token = viewUrl ? new URL(viewUrl).searchParams.get("token") : null;
  if (!token) throw new Error("the fake Chromecast has no launcher token");
  const all = await json<Sitting[]>(`${API}/api/v1/me/instances`, token);
  return all.filter((i) => i.appId === "story-nook");
}

describe("starting Story Nook once is one sitting", () => {
  beforeAll(async () => {
    await freshLaunchWithOnboardingDone();
  });

  it("Play → Cast: the couch's sitting and the phone page's report are one sitting", async () => {
    await element(by.id("tabLibrary")).tap();
    await waitFor(element(by.id("libraryGame-story-nook")))
      .toBeVisible()
      .whileElement(by.id("libraryScreen"))
      .scroll(200, "down");
    await element(by.id("libraryGame-story-nook")).tap();
    await waitFor(element(by.id("gamePlay")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("gamePlay")).tap();
    await waitFor(element(by.id("castPromptTV-fake-living-room")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("castPromptTV-fake-living-room")).tap();
    await element(by.id("castPromptConfirm")).tap();
    await waitFor(element(by.id("gameScreen")))
      .toExist()
      .withTimeout(20000);

    // The phone page declares the TV page (the launcher frames it) and reports its room.
    const tv = await until(
      () => json<Tv>(`${CAST}/launcher`),
      (t) => t.dom?.frameApp === "story-nook",
      45000,
    );
    if (tv.dom?.frameApp !== "story-nook")
      throw new Error(`the TV never framed Story Nook: ${JSON.stringify(tv.dom)}`);
    const reported = await until(
      storyNookInstances,
      (list) => list.some((i) => /^Room [A-Z]{4}$/.test(i.title ?? "")),
      20000,
    );

    // The game's page lists one sitting (Home parks it on the TV: still one).
    await element(by.id("swipeHintOverlay")).swipe("right", "fast", 0.8, 0.02, 0.5);
    await waitFor(element(by.id("gameSittings")))
      .toExist()
      .withTimeout(10000);
    await shot("one-sitting-game-page");
    // The couch's sitting is listed, and the room is not listed again under the game's own id
    // (before the fix: "Game 1" and "Game 2", both just now). Detox on iOS can't count by a
    // RegExp id (it reaches the app as a literal string), so the two ids are checked by name.
    const room = reported.map((i) => /^Room ([A-Z]{4})$/.exec(i.title ?? "")?.[1]).find(Boolean);
    await expect(element(by.id(`gameSitting-story-nook:${room}`))).not.toExist();
    for (const r of reported) await expect(element(by.id(`gameSitting-${r.instanceId}`))).toExist();
    // One row, filed under the couch session's sitting (`story-nook-<time>`), not the room's id.
    if (reported.length !== 1 || !/^story-nook-[a-z0-9]+$/.test(reported[0].instanceId))
      throw new Error(`Story Nook instances: ${JSON.stringify(reported)}`);
  });
});
