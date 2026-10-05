// Several households play one game (docs/acceptance/2026-10-05-multi-couch.feature): the Mumm phone.
// Run by e2e/multi-couch.mjs, which drives the TVs, the other phones and Night Flight, and answers
// on MC_COORD: GET /wait/<step> blocks until the orchestrator (or this test) posts /step/<step>.
// Needs a Release build with EXPO_PUBLIC_OGS_API = E2E_OGS_API, EXPO_PUBLIC_FAKE_CAST=1 and
// EXPO_PUBLIC_FAKE_CAST_URL = $MC_COORD/load (the orchestrator is the fake Chromecast).
import { by, device, element, expect, waitFor } from "detox";
import { skipOnboarding } from "./helpers";

const API = process.env.E2E_OGS_API ?? "http://localhost:8798";
const COORD = process.env.MC_COORD ?? "http://localhost:5281";

const field = (o: unknown, key: string): unknown =>
  typeof o === "object" && o !== null && key in o
    ? Object.getOwnPropertyDescriptor(o, key)?.value
    : undefined;
const str = (o: unknown, key: string): string => {
  const v = field(o, key);
  if (typeof v !== "string") throw new Error(`expected ${key}`);
  return v;
};

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
async function redeem(code: string, token: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/friends/invites/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`redeem: ${res.status} ${await res.text()}`);
}

/** Add a friend: my code on screen; `token` (their app) types it. */
async function friendByCode(token: string): Promise<void> {
  await element(by.id("tabFriends")).tap();
  await waitFor(element(by.id("addFriend")))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id("addFriend")).tap();
  await waitFor(element(by.id("inviteQr")))
    .toExist()
    .withTimeout(10000);
  const attrs = await element(by.id("inviteCode")).getAttributes();
  const code = "text" in attrs && typeof attrs.text === "string" ? attrs.text : "";
  if (!/^[A-Z]{4}-[2-9]{2}$/.test(code)) throw new Error(`no invite code on screen: ${code}`);
  await redeem(code, token);
  await element(by.id("addFriendClose")).tap();
}

async function acceptFrom(handle: string): Promise<void> {
  await element(by.id("tabProfile")).tap();
  await element(by.id("tabFriends")).tap();
  await waitFor(element(by.id(`accept-${handle}`)))
    .toBeVisible()
    .withTimeout(10000);
  await element(by.id(`accept-${handle}`)).tap();
  await waitFor(element(by.id(`friend-${handle}`)))
    .toBeVisible()
    .withTimeout(10000);
}

describe("Several households: the Mumm phone", () => {
  jest.setTimeout(15 * 60 * 1000);

  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await skipOnboarding("Jonathan");
  });

  it("makes friends with the Smiths and the Parks", async () => {
    const people = await wait("people");
    const sam = field(people, "sam");
    const kim = field(people, "kim");
    await friendByCode(str(sam, "token"));
    await friendByCode(str(kim, "token"));
    await acceptFrom(str(sam, "handle"));
    await acceptFrom(str(kim, "handle"));
    await step("friends");
  });

  it("casts the Mumm TV", async () => {
    await element(by.id("tabTV")).tap();
    await waitFor(element(by.id("castButton")))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id("castButton")).tap();
    await waitFor(element(by.id("remoteOk")))
      .toBeVisible()
      .withTimeout(30000);
    await step("cast");
  });

  it("invites the Smiths and the Parks to Night Flight from Playing", async () => {
    const people = await wait("mumm-live");
    await element(by.id("tabPlaying")).tap();
    await waitFor(element(by.id("inviteFriends")))
      .toBeVisible()
      .withTimeout(30000);
    await element(by.id("inviteFriends")).tap();
    const sam = str(field(people, "sam"), "handle");
    const kim = str(field(people, "kim"), "handle");
    await waitFor(element(by.id(`inviteFriend-${sam}`)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id(`inviteFriend-${sam}`)).tap();
    await element(by.id(`inviteFriend-${kim}`)).tap();
    await element(by.id("inviteSend")).tap();
    await waitFor(element(by.id("inviteDone")))
      .toHaveText("Invited Sam and Kim.")
      .withTimeout(10000);
    await step("invited");
    await new Promise((r) => setTimeout(r, 1500));
    await element(by.id("inviteDoneButton")).tap();
    await expect(element(by.id("nowPlaying"))).toExist();
    // Stay on Playing while the other households join, in this same test: e2e/setup.ts reloads
    // React Native before every test, and a cold start opens Library.
    await wait("done");
  });
});
