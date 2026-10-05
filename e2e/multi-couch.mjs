// Several households play one game, end to end (docs/acceptance/2026-10-05-multi-couch.feature):
// three couches (Mumm, Smith, Park), each with its own TV launcher in its own recorded Playwright
// context, join one Night Flight room. The Mumm phone is the iOS app in the simulator under Detox
// (apps/mobile/e2e/multi-couch.test.ts) or, with MUMM_PHONE=scripted, an API client. The other
// phones are scripted couch clients (like couch-flow.mjs) plus Night Flight's phone page in a
// fake OGS WebView (the app's bridge stores, with real game tokens from the local API).
// Everything renders locally: no Cloud Run, no GPU, no SFU.
//
// Needs running: API (OGS_API, 8798; CATALOGUE_START_URLS points night-flight at GAME), launcher
// (OGS_TV, 5280, built), Night Flight (GAME, 8797; OGS_JWKS_URL = the API's JWKS). This script is
// the fake Chromecast and the Detox step server on MC_PORT (5281). See docs/testing/e2e.md.
//   node multi-couch.mjs                      # MUMM_PHONE=detox: DETOX_IOS_BINARY, DETOX_SIM_NAME
//   MUMM_PHONE=scripted node multi-couch.mjs
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import WebSocket from "ws";

const API = process.env.OGS_API ?? "http://localhost:8798";
const TV = process.env.OGS_TV ?? "http://localhost:5280";
const GAME = process.env.GAME ?? "http://localhost:8797";
const PORT = Number(process.env.MC_PORT ?? 5281);
const MUMM_PHONE = process.env.MUMM_PHONE ?? "detox";
const APP_ID = "night-flight";
const OUT = resolve(
  process.env.MC_OUT ?? "../docs/exec-plans/active/evidence/2026-10-05-multi-couch",
);
const RAW = join(OUT, "raw");
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  return Boolean(ok);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[mc ${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const T0 = Date.now();

async function until(fn, what, ms = 20000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e;
    }
    await sleep(150);
  }
  throw new Error(
    `timed out waiting for ${what}${last instanceof Error ? `: ${last.message}` : ""}`,
  );
}

async function api(path, { token, body, method } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} ${res.status} ${text}`);
  return json;
}

const run = Date.now().toString(36).slice(-5);
async function person(name, sticker, kind = "phone") {
  const deviceId = `mc-${name.toLowerCase()}-${run}`;
  const made = await api("/profiles", {
    body: {
      name,
      handle: `${name.toLowerCase()}.${run}`,
      sticker,
      device: { deviceId, kind, name: `${name}'s ${kind}` },
    },
  });
  return { ...made.profile, token: made.token, deviceId, name };
}
async function befriend(a, b) {
  const r = await api("/friends/requests", { token: a.token, body: { handle: b.handle } });
  if (r.status === "requested")
    await api(`/friends/requests/${r.request.id}/accept`, { token: b.token, body: {} });
}

/** A couch-session socket (a phone, or a launcher), mirroring the state it is sent. */
function couchClient(name, token, session) {
  const ws = new WebSocket(
    `${API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(token)}&session=${encodeURIComponent(session)}`,
  );
  const c = { name, ws, msgs: [], state: null };
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw));
    c.msgs.push(m);
    if (m.type === "state") c.state = m.state;
  });
  c.open = new Promise((r, j) => {
    ws.on("open", r);
    ws.on("error", j);
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  return c;
}

const jwtPayload = (jwt) =>
  JSON.parse(
    Buffer.from(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  );

// --- Step server: the fake Chromecast (POST /load) and the Detox steps (/step, /wait) ----------

const steps = new Map();
const stepWaiters = new Map();
function setStep(name, body = {}) {
  steps.set(name, body);
  for (const w of stepWaiters.get(name) ?? []) w(body);
  stepWaiters.delete(name);
}
function waitStep(name, ms = 600000) {
  if (steps.has(name)) return Promise.resolve(steps.get(name));
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`no step ${name}`)), ms);
    stepWaiters.set(name, [...(stepWaiters.get(name) ?? []), (b) => (clearTimeout(t), res(b))]);
  });
}
let onLoad = async () => {};
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || "{}") : {};
  const [, kind, name] = (req.url ?? "").split("?")[0].split("/");
  if (req.method === "POST" && kind === "load") {
    await onLoad(body.viewUrl);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
  } else if (req.method === "POST" && kind === "stop") res.writeHead(200).end("{}");
  else if (req.method === "POST" && kind === "step") {
    log(`step ${name}`);
    setStep(name, body);
    res.writeHead(200).end("{}");
  } else if (req.method === "GET" && kind === "wait") {
    const got = await Promise.race([
      waitStep(name).catch(() => null),
      sleep(20000).then(() => undefined),
    ]);
    if (got === undefined || got === null) res.writeHead(204).end();
    else res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(got));
  } else if (req.method === "GET" && kind === "status")
    res.writeHead(200).end(JSON.stringify({ loads: 0 }));
  else res.writeHead(404).end();
});
await new Promise((r) => server.listen(PORT, r));

// --- Browsers ----------------------------------------------------------------------------------

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
async function tvPage(name) {
  const context = await browser.newContext({
    // A TV: the launcher lays out for 1920x1080 (what a Chromecast gives it).
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: join(RAW, name), size: { width: 960, height: 540 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => log(`[${name}] pageerror ${e.message}`));
  return { name, context, page };
}
const tvs = {
  mumm: await tvPage("mumm-tv"),
  smith: await tvPage("smith-tv"),
  park: await tvPage("park-tv"),
};
for (const t of Object.values(tvs))
  await t.page.setContent(
    // A slow pulse keeps frames coming, so the clip covers the whole wait.
    `<style>@keyframes p{50%{opacity:.4}}</style><body style="margin:0;background:#120f22;color:#e6dacb;font:48px sans-serif;display:grid;place-items:center;height:100vh"><span style="animation:p 2s infinite">${t.name.replace("-tv", "")} TV: not cast yet</span></body>`,
  );
const phones = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });

const CAST_STATE = {
  isAvailable: true,
  devices: [{ id: "tv-1", name: "TV", type: "chromecast" }],
  session: {
    status: "connected",
    deviceId: "tv-1",
    deviceName: "TV",
    sessionId: "s",
    streamSessionId: null,
  },
  error: null,
  viewUrl: null,
};
/** The OGS app's WebView: cast, ogs and profile stores (a real game token for this couch). */
const fakeWebView = (profile) => `
  window.__ogsSent = [];
  const init = (storeKey, data) => window.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type: "STATE_INIT", storeKey, data }) }));
  window.ReactNativeWebView = {
    postMessage(raw) {
      const msg = JSON.parse(raw);
      window.__ogsSent.push(msg);
      if (msg.type === "BRIDGE_READY") setTimeout(() => {
        init("cast", ${JSON.stringify(CAST_STATE)});
        init("ogs", { reported: [] });
        init("profile", { status: "ready", profile: ${JSON.stringify(profile)} });
      }, 50);
    },
  };
`;

/** A phone in the OGS app opening Night Flight's start page as host of this couch's sitting. */
async function gamePhone(who, sessionId, url) {
  const grant = await api(`/games/${APP_ID}/token`, { token: who.token, body: { sid: sessionId } });
  const page = await phones.newPage();
  await page.addInitScript(fakeWebView({ ...grant.profile, token: grant.token }));
  page.on("pageerror", (e) => log(`[${who.name} phone] pageerror ${e.message}`));
  await page.goto(url);
  debugPages.push({ name: who.name, page });
  return page;
}
const debugPages = [];
/** What the app does with the page's SET_VIEW_URL while cast: game.view to the couch session. */
async function forwardView(page, couch) {
  const url = await until(
    () =>
      page.evaluate(
        () => window.__ogsSent.find((m) => m.event?.type === "SET_VIEW_URL")?.event?.url ?? null,
      ),
    "the phone page's TV view",
  );
  couch.send({ type: "game.view", appId: APP_ID, url });
  return url;
}
const roomOf = (page) => new URL(page.url()).pathname.split("/")[2];

/** The game's TV page inside a launcher. */
const gameFrame = (tv) => tv.page.frames().find((f) => /\/tv\/[A-Z]{4}/.test(f.url()));
async function tvAttrs(tv) {
  const f = gameFrame(tv);
  if (!f) return null;
  return f.evaluate(() => {
    const el = document.querySelector(".tv");
    return el
      ? {
          room: el.dataset.room,
          households: Number(el.dataset.households),
          owls: el.dataset.owls,
          sun: el.dataset.sun,
        }
      : null;
  });
}
const launcherScreen = (tv) =>
  tv.page.evaluate(() => document.querySelector(".launcher")?.getAttribute("data-screen") ?? null);
async function shoot(tv, name) {
  await tv.page.screenshot({ path: join(OUT, `${name}.png`) }).catch(() => {});
}

/** Casts a couch: a session for its host, its launcher in its TV context, the host's socket. */
async function cast(host, tv, tvName) {
  const s = await api("/sessions", { token: host.token, body: { tvName } });
  await tv.page.goto(`${TV}/?api=${encodeURIComponent(API)}&token=${encodeURIComponent(s.token)}`);
  const couch = couchClient(host.name, host.token, s.sessionId);
  await couch.open;
  await until(() => couch.state?.cast, `${tvName} cast`);
  return { session: s, couch };
}

// --- The run ----------------------------------------------------------------------------------

let detox = null;
let simRec = null;
const simStart = { at: null, file: join(RAW, "mumm-phone.mp4") };
try {
  const mom = await person("Mom", "owl");
  const sam = await person("Sam", "fox");
  const kim = await person("Kim", "dragon");
  await befriend(sam, kim);
  const people = {
    sam: { handle: sam.handle, token: sam.token },
    kim: { handle: kim.handle, token: kim.token },
  };

  // The Mumm phone casts the Mumm TV; the launcher loads in the Mumm TV context.
  let mummSession = null;
  onLoad = async (viewUrl) => {
    log("fake Chromecast LOAD_VIEW", viewUrl.slice(0, 60));
    const token = new URL(viewUrl).searchParams.get("token");
    mummSession = { sessionId: jwtPayload(token).sid, launcherToken: token };
    await tvs.mumm.page.goto(viewUrl);
  };
  let jonathan = null;
  if (MUMM_PHONE === "detox") {
    detox = startDetox();
    setStep("people", people);
    await waitStep("friends");
    await waitStep("cast");
  } else {
    jonathan = await person("Jonathan", "bear");
    await befriend(jonathan, sam);
    await befriend(jonathan, kim);
    const s = await api("/sessions", { token: jonathan.token, body: { tvName: "Mumm TV" } });
    await onLoad(`${TV}/?api=${encodeURIComponent(API)}&token=${encodeURIComponent(s.token)}`);
  }
  await until(() => mummSession, "the Mumm cast");
  const mummView = await api(`/sessions/${mummSession.sessionId}`, {
    token: mummSession.launcherToken,
  });
  check(
    "the Mumm phone cast the Mumm TV (its launcher is up)",
    (await until(() => launcherScreen(tvs.mumm), "Mumm launcher")) !== null,
    `TV code ${mummView.code}`,
  );

  // 1. The Mumms start Night Flight (Mom's phone hosts it), and the game creates room R.
  await api("/sessions/join", { token: mom.token, body: { code: mummView.code } });
  const momCouch = couchClient("mom", mom.token, mummSession.sessionId);
  await momCouch.open;
  await until(() => momCouch.state?.cast, "Mom on the Mumm couch");
  momCouch.send({ type: "game.start", appId: APP_ID, mode: "new", hostDeviceId: mom.deviceId });
  const momPhone = await gamePhone(mom, mummSession.sessionId, `${GAME}/`);
  await until(() => /\/join\/[A-Z]{4}/.test(momPhone.url()), "Mom's phone in a room");
  const R = roomOf(momPhone);
  await forwardView(momPhone, momCouch);
  log(`room ${R}`);
  const kid = await phones.newPage();
  await kid.goto(`${GAME}/join/${R}`);
  await kid.getByLabel("I'm a kid").click();
  await until(async () => (await tvAttrs(tvs.mumm))?.room === R, "Mumm TV in the room", 30000);
  await until(() => momCouch.state?.current?.room === R, "the Mumm sitting names the room");
  check(
    "1. Night Flight made room R and the Mumm couch's sitting names it",
    momCouch.state.current.room === R,
    R,
  );
  await shoot(tvs.mumm, "01-mumm-room");

  // 2. A Mumm phone taps "Invite friends to this game".
  let invite;
  if (MUMM_PHONE === "detox") {
    setStep("mumm-live", people);
    await waitStep("invited");
    invite = { link: `https://opengame.org/play/${APP_ID}?room=${R}` };
    check(
      "2. the Mumm phone (iOS app) invited the Smiths and the Parks",
      true,
      "Detox: Invited Sam and Kim.",
    );
  } else {
    invite = await api(`/games/${APP_ID}/invites`, {
      token: jonathan.token,
      body: { room: R, to: [sam.id, kim.id] },
    });
    check(
      "2. the Mumm phone invited the Smiths and the Parks",
      invite.invited.length === 2,
      invite.link,
    );
  }
  const play = new URL(invite.link);
  check(
    "the invite link is opengame.org/play/<appId>?room=R",
    play.pathname === `/play/${APP_ID}` && play.searchParams.get("room") === R,
    invite.link,
  );

  // 3. The Smiths tap it: cast first (their TV wasn't), then game.start into room R on their TV.
  const smith = await cast(sam, tvs.smith, "Smith TV");
  smith.couch.send({
    type: "game.start",
    appId: APP_ID,
    mode: "new",
    hostDeviceId: sam.deviceId,
    room: R,
  });
  await until(() => smith.couch.state?.current?.room === R, "Smith sitting in room R");
  const samPhone = await gamePhone(sam, smith.session.sessionId, `${GAME}/?ogsRoom=${R}`);
  await until(() => roomOf(samPhone) === R, "Sam's phone in room R");
  await forwardView(samPhone, smith.couch);
  await until(async () => (await tvAttrs(tvs.smith))?.room === R, "Smith TV in room R", 30000);
  check("3. the Smiths' link started Night Flight in room R on the Smith TV", true, R);

  // 4. The Parks join from Playing: "Jonathan and Sam are playing Night Flight", Join with your couch.
  const park = await cast(kim, tvs.park, "Park TV");
  const rooms = await until(async () => {
    const list = await api("/friends/rooms", { token: kim.token });
    return list.find((r) => r.room === R && r.couches.length === 2) ?? null;
  }, "the Parks' room card");
  const labels = rooms.couches.map((c) => c.label);
  const title = `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)} are playing ${rooms.game.name}`;
  check(
    "4. Playing card for the Parks: Mumms and Smiths are playing",
    title === "Jonathan and Sam are playing Night Flight",
    title,
  );
  park.couch.send({
    type: "game.start",
    appId: APP_ID,
    mode: "new",
    hostDeviceId: kim.deviceId,
    room: R,
  });
  const kimPhone = await gamePhone(kim, park.session.sessionId, `${GAME}/?ogsRoom=${R}`);
  await until(() => roomOf(kimPhone) === R, "Kim's phone in room R");
  await forwardView(kimPhone, park.couch);

  // 5. Every TV shows room R, and the game sees three couches.
  const all = await until(
    async () => {
      const a = await Promise.all(Object.values(tvs).map(tvAttrs));
      return a.every((x) => x?.room === R && x.households === 3) ? a : null;
    },
    "three TVs in room R with three households",
    40000,
  );
  check(
    "5. all three TVs show room R",
    all.every((x) => x.room === R),
    all.map((x) => x.room).join(","),
  );
  check(
    "the game sees three couches",
    all.every((x) => x.households === 3),
    all.map((x) => x.households).join(","),
  );
  for (const [k, t] of Object.entries(tvs)) await shoot(t, `05-${k}-room`);

  // Mom (the host) starts the flight; turns go Mumm, Smith, Park round-robin.
  await momPhone.getByRole("button", { name: /start/i }).first().click();
  await until(
    async () => (await tvAttrs(tvs.mumm))?.owls?.split(",").length === 3,
    "the deal: one owl per household",
  );
  /** Plays the turn on this page if it is its turn (grown-up: first card, then its owl). */
  async function playIfTurn(page) {
    const card = page.locator(".gu-card:not([disabled]), .kid-card.glow").first();
    if (!(await card.count())) return false;
    // The playable cards bob (an animation), so they are never "stable" for a normal click.
    await card.click({ force: true });
    const owl = page.locator(".owl-choice").first();
    await owl
      .waitFor({ timeout: 1500 })
      .then(() => owl.click({ force: true }))
      .catch(() => {});
    return true;
  }
  const samsTurn = async () => (await samPhone.locator(".gu-card:not([disabled])").count()) > 0;
  await until(
    async () => {
      if (await samsTurn()) return true;
      for (const p of [momPhone, kid, kimPhone]) if (await playIfTurn(p)) await sleep(3000);
      return false;
    },
    "Sam's turn",
    60000,
  );
  const before = await Promise.all(Object.values(tvs).map(tvAttrs));
  await playIfTurn(samPhone);
  const after = await until(async () => {
    const a = await Promise.all(Object.values(tvs).map(tvAttrs));
    const moved = a.every((x, i) => x && (x.owls !== before[i].owls || x.sun !== before[i].sun));
    const same = a.every((x) => x.owls === a[0].owls && x.sun === a[0].sun);
    return moved && same ? a : null;
  }, "Sam's card on every TV");
  check(
    "a card played on a Smith phone moves the board on all three TVs",
    true,
    `owls ${before[0].owls} -> ${after[0].owls}, sun ${before[0].sun} -> ${after[0].sun}`,
  );
  await sleep(2600);
  for (const [k, t] of Object.entries(tvs)) await shoot(t, `06-${k}-after-smith-card`);

  // 6. Home on the Smith TV parks only that TV; Continue brings it back into room R.
  const smithInstance = smith.couch.state.current.instanceId;
  smith.couch.send({ type: "home" });
  await until(async () => (await launcherScreen(tvs.smith)) === "home", "Smith launcher home");
  const awayOnMumm = await until(
    () =>
      gameFrame(tvs.mumm)?.evaluate(
        () => document.querySelector('[data-household="Sam"]')?.getAttribute("data-away") === "1",
      ),
    "the Smiths marked away on the Mumm TV",
  );
  const othersOn =
    (await launcherScreen(tvs.mumm)) === "game" && (await launcherScreen(tvs.park)) === "game";
  const othersInRoom =
    (await tvAttrs(tvs.mumm))?.room === R && (await tvAttrs(tvs.park))?.room === R;
  check(
    "6. Home on the Smith TV parks only that TV (Mumm and Park still in room R; Smiths away)",
    awayOnMumm && othersOn && othersInRoom && smith.couch.state.suspended[0]?.room === R,
  );
  for (const [k, t] of Object.entries(tvs)) await shoot(t, `07-${k}-smith-home`);
  await sleep(2500);
  smith.couch.send({
    type: "game.start",
    appId: APP_ID,
    mode: "continue",
    hostDeviceId: sam.deviceId,
  });
  await until(
    async () =>
      (await launcherScreen(tvs.smith)) === "game" && (await tvAttrs(tvs.smith))?.room === R,
    "Smith back in room R",
  );
  await until(
    () =>
      gameFrame(tvs.mumm)?.evaluate(
        () => document.querySelector('[data-household="Sam"]')?.getAttribute("data-away") === "0",
      ),
    "the Smiths back on the Mumm TV",
  );
  check(
    "Continue resumes the Smith TV in room R (same sitting, same frame)",
    smith.couch.state.current.instanceId === smithInstance && smith.couch.state.current.room === R,
    smithInstance,
  );
  for (const [k, t] of Object.entries(tvs)) await shoot(t, `08-${k}-smith-back`);

  // 7. Each couch keeps a "Room R" sitting.
  const sittings = [momCouch, smith.couch, park.couch].map((c) => c.state.current);
  check(
    "7. each couch keeps a sitting in room R",
    sittings.every((s) => s?.appId === APP_ID && s.room === R),
    sittings.map((s) => `${s?.room}:${s?.label}`).join(" "),
  );
  await sleep(3000);
  for (const c of [momCouch, smith.couch, park.couch]) c.ws.close();
} catch (e) {
  check("flow completed", false, String(e?.stack ?? e));
  for (const d of debugPages) {
    const text = await d.page
      .evaluate(() => document.body.innerText.slice(0, 300))
      .catch(() => "?");
    const sent = await d.page
      .evaluate(() =>
        JSON.stringify(
          window.__ogsSent?.map((m) => m.type + ":" + (m.event?.type ?? m.storeKey ?? "")),
        ).slice(0, 400),
      )
      .catch(() => "?");
    log(
      `[debug ${d.name}] ${d.page.url()}\n  text: ${text.replace(/\n/g, " | ")}\n  sent: ${sent}`,
    );
    await d.page.screenshot({ path: join(OUT, `debug-${d.name}.png`) }).catch(() => {});
  }
}

setStep("done");
if (detox) await detox.done;
if (simRec) {
  simRec.kill("SIGINT");
  await new Promise((r) => simRec.on("exit", r));
}
const videos = {};
const ends = {};
for (const t of Object.values(tvs)) {
  const v = t.page.video();
  // Playwright starts a clip at its first painted frame but pads it to the close: align it by its end.
  ends[t.name] = Date.now();
  await t.context.close();
  if (v) videos[t.name] = await v.path();
}
await phones.close();
await browser.close();
server.close();

// --- One synced 2x2 video: Mumm phone | Mumm TV / Smith TV | Park TV (compose-2x2.mjs) -------
const tiles = [
  // simctl starts recording when asked: align the phone by its start.
  simRec ? { file: simStart.file, at: simStart.at, label: "Mumm phone (iOS app)" } : null,
  { file: videos["mumm-tv"], end: ends["mumm-tv"], label: "Mumm TV" },
  { file: videos["smith-tv"], end: ends["smith-tv"], label: "Smith TV" },
  { file: videos["park-tv"], end: ends["park-tv"], label: "Park TV" },
].filter(Boolean);
writeFileSync(join(RAW, "tiles.json"), JSON.stringify(tiles, null, 2));
try {
  const out = join(OUT, "multi-couch-2x2.mp4");
  execFileSync("node", ["compose-2x2.mjs", join(RAW, "tiles.json"), out], { stdio: "inherit" });
  check("synced 2x2 video saved", true, out);
} catch (e) {
  check("synced 2x2 video saved", false, String(e));
}

writeFileSync(
  join(OUT, "results.json"),
  JSON.stringify({ at: new Date().toISOString(), mummPhone: MUMM_PHONE, results }, null, 2),
);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

// --- Detox + simulator recording -------------------------------------------------------------
function startDetox() {
  const sim = process.env.DETOX_SIM_NAME;
  if (!sim || !process.env.DETOX_IOS_BINARY)
    throw new Error("set DETOX_SIM_NAME and DETOX_IOS_BINARY");
  const child = spawn(
    "pnpm",
    ["exec", "detox", "test", "--configuration", "ios.sim.release", "e2e/multi-couch.test.ts"],
    {
      cwd: resolve("../apps/mobile"),
      env: { ...process.env, E2E_OGS_API: API, MC_COORD: `http://localhost:${PORT}` },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  const done = new Promise((r) => child.on("exit", (code) => r(code)));
  done.then((code) => check("Detox: the Mumm phone's test passed", code === 0, `exit ${code}`));
  // Record the simulator once it has booted.
  void (async () => {
    for (let i = 0; i < 600 && !simRec; i++) {
      const list = execFileSync("xcrun", ["simctl", "list", "devices", "booted"]).toString();
      const m = list.split("\n").find((l) => l.includes(`${sim} (`));
      const udid = m?.match(/\(([0-9A-F-]{36})\)/)?.[1];
      if (udid) {
        simStart.at = Date.now();
        simRec = spawn(
          "xcrun",
          ["simctl", "io", udid, "recordVideo", "--codec=h264", "--force", simStart.file],
          { stdio: "ignore" },
        );
        log(`recording the simulator ${udid}`);
        break;
      }
      await sleep(500);
    }
  })();
  return { child, done };
}
