import { initialSession, reduceSession, type SessionState } from "@open-game-system/ogs-protocol";
import { type Browser, chromium, type Page, type WebSocketRoute } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { CatalogueResponse, CouchSessionSchema, ProfileSchema } from "../src/session/data";
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

/**
 * Against a real OGS API (OGS_LIVE_API, default http://localhost:8790): profiles, a session from
 * the host's phone, a friend joining with the TV code, both phones on the couch socket.
 * Skipped when nothing there answers like the OGS API's health check.
 */
const LIVE_API = (process.env.OGS_LIVE_API ?? "http://localhost:8790").replace(/\/+$/, "");
const HealthSchema = z.object({ status: z.literal("ok") });
const apiUp = await fetch(`${LIVE_API}/api/v1/health`, { signal: AbortSignal.timeout(2000) })
  .then(async (r) => r.ok && HealthSchema.safeParse(await r.json()).success)
  .catch(() => false);

const CreatedProfileSchema = z.object({ profile: ProfileSchema, token: z.string().min(1) });
const CreatedSessionSchema = CouchSessionSchema.extend({ token: z.string().min(1) });

async function call<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${LIVE_API}/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return schema.parse(await res.json());
}

const run = Math.random().toString(36).slice(2, 8);
const newProfile = (name: string, sticker: string) =>
  call("/profiles", CreatedProfileSchema, {
    body: {
      name,
      sticker,
      device: {
        deviceId: `e2e-${name.toLowerCase()}-${run}`,
        kind: "phone",
        name: `${name}'s phone`,
      },
    },
  });

/** A phone on the couch socket: joins the session and says hello with its profile. */
function phoneOnCouch(
  token: string,
  sessionId: string,
  profile: z.infer<typeof ProfileSchema>,
  deviceId: string,
): Promise<WebSocket> {
  const url = `${LIVE_API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(token)}&session=${encodeURIComponent(sessionId)}`;
  const ws = new WebSocket(url);
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          type: "hello",
          deviceId,
          kind: "phone",
          profile: { profileId: profile.id, name: profile.name, sticker: profile.sticker },
        }),
      );
      resolve(ws);
    });
    ws.addEventListener("error", () => reject(new Error(`couch socket failed: ${url}`)));
  });
}

describe.skipIf(!apiUp)(`launcher against the OGS API at ${LIVE_API}`, () => {
  const sockets: WebSocket[] = [];
  afterAll(() => {
    for (const ws of sockets) ws.close();
  });

  it("shows the host's session: title, members who joined, the TV code and the host's library", async () => {
    const host = await newProfile("Jonathan", "bear");
    const friend = await newProfile("Mom", "owl");
    const catalogue = await call("/catalogue", CatalogueResponse);
    const library = catalogue
      .filter((g) => g.tv !== "none")
      .slice(0, 2)
      .map((g) => g.appId)
      .reverse();
    await call("/me/library", z.object({ appIds: z.array(z.string()) }), {
      method: "PUT",
      token: host.token,
      body: { appIds: library },
    });
    const session = await call("/sessions", CreatedSessionSchema, {
      token: host.token,
      body: { tvName: "Living room TV" },
    });
    const joined = await call("/sessions/join", CouchSessionSchema, {
      token: friend.token,
      body: { code: session.code },
    });
    expect(joined.sessionId).toBe(session.sessionId);

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/?api=${encodeURIComponent(LIVE_API)}&token=${session.token}`);
    await page.getByTestId("home").waitFor({ timeout: 15_000 });
    expect(await page.locator(".room-name").textContent()).toBe(
      `Living room TV · ${host.profile.name}'s games`,
    );
    expect(await page.getByTestId("join-code").textContent()).toContain(session.code);
    const shelf = await page
      .locator("[data-row=library] [data-item]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-item")));
    expect(shelf).toEqual(library.map((id) => `game:${id}`));

    sockets.push(await phoneOnCouch(host.token, session.sessionId, host.profile, `e2e-jp-${run}`));
    sockets.push(
      await phoneOnCouch(friend.token, session.sessionId, friend.profile, `e2e-mp-${run}`),
    );
    await expect
      .poll(() => page.locator("[data-testid=couch] figcaption").allTextContents(), {
        timeout: 10_000,
      })
      .toEqual([host.profile.name, friend.profile.name]);
    expect(await page.getByTestId("remote-chip").textContent()).toContain(
      `${host.profile.name} has the remote`,
    );
    await settle(page);
    await page.screenshot({ path: `${SHOTS}11-live-api-home.png` });
    await context.close();
  });
});
