import { initialSession, reduceSession, type SessionState } from "@open-game-system/ogs-protocol";
import { type Browser, chromium, type Page, type WebSocketRoute } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  FIXTURE_GAMES,
  FIXTURE_MEMBERS,
  FIXTURE_SESSION,
  fixtureInstances,
} from "../src/session/fixture";
import { BASE, SHOTS, settle } from "./harness";

/** The live path (API mocked): launcher URL → JWT sid → API fetches with the bearer → couch socket. */
const API = "https://api.ogs.test";
const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const TOKEN = `eyJhbGciOiJIUzI1NiJ9.${b64url({ sub: "jonathan", did: "tv-1", kind: "launcher", sid: FIXTURE_SESSION.sessionId, exp: 9999999999 })}.sig`;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser.close();
});

function seeded(): SessionState {
  let s = initialSession(FIXTURE_SESSION.sessionId, "jonathan");
  s = reduceSession(
    s,
    { type: "hello", deviceId: "mom-phone", kind: "phone", profile: FIXTURE_MEMBERS[1] },
    1,
  ).state;
  s = reduceSession(s, { type: "hello", deviceId: "tv-1", kind: "launcher" }, 2).state;
  return s;
}

async function openLive(): Promise<{
  page: Page;
  sockets: WebSocketRoute[];
  sent: unknown[];
  auth: string[];
}> {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const auth: string[] = [];
  const sent: unknown[] = [];
  const sockets: WebSocketRoute[] = [];
  const json = (body: unknown) => ({
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: { "access-control-allow-origin": "*" },
  });
  await page.route(`${API}/api/v1/**`, (r) => {
    if (r.request().method() === "OPTIONS")
      return r.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization",
        },
      });
    auth.push(r.request().headers().authorization ?? "");
    const path = new URL(r.request().url()).pathname;
    if (path === "/api/v1/catalogue") return r.fulfill(json({ games: FIXTURE_GAMES }));
    if (path === `/api/v1/sessions/${FIXTURE_SESSION.sessionId}`)
      return r.fulfill(json(FIXTURE_SESSION));
    if (path === "/api/v1/me/instances") return r.fulfill(json(fixtureInstances(Date.now())));
    if (path === "/api/v1/me/library")
      return r.fulfill(json({ appIds: ["story-nook", "hearthisle", "rocket-crew"] }));
    return r.fulfill({ status: 404 });
  });
  await page.routeWebSocket(/\/api\/v1\/couch\/ws/, (ws) => {
    sockets.push(ws);
    ws.onMessage((m) => sent.push(JSON.parse(String(m))));
    ws.send(JSON.stringify({ type: "state", state: seeded() }));
  });
  await page.goto(`${BASE}/?api=${encodeURIComponent(API)}&token=${TOKEN}`);
  return { page, sockets, sent, auth };
}

it("loads the session and the host's library with the bearer token, then the couch from the socket", async () => {
  const { page, sockets, sent, auth } = await openLive();
  await page.getByTestId("home").waitFor();
  expect(new URL(sockets[0]?.url() ?? "").searchParams.get("token")).toBe(TOKEN);
  expect(auth.length).toBe(4);
  expect(auth.every((a) => a === `Bearer ${TOKEN}`)).toBe(true);
  expect(await page.getByTestId("remote-chip").textContent()).toContain("Mom has the remote");
  expect(await page.locator(".room-name").textContent()).toBe("Living room TV · Jonathan's games");
  expect(await page.locator("[data-testid=couch] figcaption").allTextContents()).toEqual(["Mom"]);
  expect(await page.getByTestId("join-code").textContent()).toContain(FIXTURE_SESSION.code);
  // Only the host's library is on the shelf, in its order.
  const shelf = await page
    .locator("[data-item]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
  expect(shelf).toEqual(["game:story-nook", "game:hearthisle", "game:rocket-crew"]);
  // No focus yet: the launcher places the ring on its first box and tells the session.
  await expect.poll(() => sent).toContainEqual({ type: "focus.set", itemId: "game:story-nook" });
  // A remote press arrives as focus.move; the launcher answers with where the ring goes.
  sockets[0]?.send(
    JSON.stringify({ type: "state", state: { ...seeded(), focus: "game:story-nook" } }),
  );
  sockets[0]?.send(JSON.stringify({ type: "focus.move", dir: "down" }));
  await expect.poll(() => sent).toContainEqual({ type: "focus.set", itemId: "game:hearthisle" });
  // The launcher never says hello: a reconnect must not count as a recast.
  expect(
    sent.some((m) => typeof m === "object" && m !== null && "type" in m && m.type === "hello"),
  ).toBe(false);
  await settle(page);
  await page.screenshot({ path: `${SHOTS}10-live-home.png` });
});

it("keeps the last state while the socket is down, then reconnects", async () => {
  const { page, sockets } = await openLive();
  await page.getByTestId("home").waitFor();
  await sockets[0]?.close();
  await page.getByTestId("reconnecting").waitFor();
  expect(await page.getByTestId("home").isVisible()).toBe(true);
  await expect.poll(() => sockets.length, { timeout: 5000 }).toBe(2);
  await page.getByTestId("reconnecting").waitFor({ state: "detached" });
});
