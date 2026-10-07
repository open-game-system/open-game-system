// Every couch phone follows the TV, end to end (docs/acceptance/2026-10-06-join-and-invite.feature,
// "Every phone follows the TV"). One couch: Dad casts (a recorded TV launcher in Playwright) and his
// phone starts Rocket Crew (a scripted couch client plus Rocket Crew's phone page in a fake OGS
// WebView with a real game token). Mom's phone is the iOS app in the simulator under Detox
// (apps/mobile/e2e/phones-follow.test.ts): she joins with the TV code and never taps the game.
// Asserts: her phone waits while the TV hasn't named the room, then opens the TV's room (her WebView
// lands on /join/<R>), Rocket Crew's room has two seats (Dad the Captain, Mom the Fixer, by OGS id);
// stepping out leaves the TV playing; Home + Continue brings her back into the same room and seat;
// Home sends her phone back to the remote. Juneau's iPad (a tablet profile: a scripted couch client
// plus Rocket Crew's phone page in a fake OGS WebView, opened the way the app's followStep opens it)
// is on the couch with no roster sent: it follows into the same room as a player (Rocket Crew's
// Lookout seat), its page's TV view never reframes the TV (only the host's page counts), and Home
// sends it back to the remote. Everything local: no Cloud Run, no GPU, no SFU.
//
// Needs running: API (OGS_API, 8848; CATALOGUE_START_URLS points rocket-crew at GAME), launcher
// (OGS_TV, 5290, built), Rocket Crew (GAME, 8847; OGS_JWKS_URL = the API's JWKS). This script is the
// Detox step server on PF_PORT (5291). See docs/testing/e2e.md.
//   DETOX_IOS_BINARY=… DETOX_SIM_NAME=… node phones-follow.mjs
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import WebSocket from "ws";

const API = process.env.OGS_API ?? "http://localhost:8848";
const TV = process.env.OGS_TV ?? "http://localhost:5290";
const GAME = process.env.GAME ?? "http://localhost:8847";
const PORT = Number(process.env.PF_PORT ?? 5291);
const APP_ID = "rocket-crew";
const OUT = resolve(
  process.env.PF_OUT ?? "../docs/exec-plans/active/evidence/2026-10-06-phones-follow",
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
const T0 = Date.now();
const log = (...a) => console.log(`[pf ${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

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

async function api(path, { token, body } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const run = Date.now().toString(36).slice(-5);
async function person(name, sticker, kind = "phone") {
  const deviceId = `pf-${name.toLowerCase()}-${run}`;
  const made = await api("/profiles", {
    body: {
      name,
      handle: `${name.toLowerCase()}.${run}`,
      sticker,
      device: { deviceId, kind, name: `${name}'s ${kind === "tablet" ? "iPad" : "phone"}` },
    },
  });
  return { ...made.profile, token: made.token, deviceId, name };
}

/** A couch-session socket, mirroring the state and keeping every frame it is sent. */
function couchClient(token, session) {
  const ws = new WebSocket(
    `${API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(token)}&session=${encodeURIComponent(session)}`,
  );
  const c = { ws, msgs: [], state: null };
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

// --- Step server for Detox (/step, /wait) -------------------------------------------------------

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
    const done = (b) => {
      clearTimeout(t);
      res(b);
    };
    stepWaiters.set(name, [...(stepWaiters.get(name) ?? []), done]);
  });
}
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString() || "{}") : {};
  const [, kind, name] = (req.url ?? "").split("?")[0].split("/");
  if (req.method === "POST" && kind === "step") {
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
  } else res.writeHead(404).end();
});
await new Promise((r) => server.listen(PORT, r));

// --- Browsers: the TV and Dad's phone page ------------------------------------------------------

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const tvContext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: join(RAW, "tv"), size: { width: 960, height: 540 } },
});
const tv = await tvContext.newPage();
tv.on("pageerror", (e) => log(`[tv] pageerror ${e.message}`));
/** Each scripted device is its own browser (Rocket Crew keeps a seat in a per-room cookie). */
const devices = [];
const deviceContext = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  devices.push(ctx);
  return ctx;
};

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
async function gamePhone(who, sessionId, url) {
  const grant = await api(`/games/${APP_ID}/token`, { token: who.token, body: { sid: sessionId } });
  const page = await (await deviceContext()).newPage();
  await page.addInitScript(fakeWebView({ ...grant.profile, token: grant.token }));
  page.on("pageerror", (e) => log(`[${who.name} phone] pageerror ${e.message}`));
  await page.goto(url);
  return page;
}
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
const roomOf = (url) => new URL(url).pathname.split("/")[2] ?? "";
/** The app's roomStartUrl (apps/mobile/services/rooms.ts): a follower joins the TV's room. */
const roomStartUrl = (startUrl, room) =>
  `${startUrl}${startUrl.includes("?") ? "&" : "?"}ogsRoom=${encodeURIComponent(room)}`;
/** The follows a couch client was sent from frame `from` on. */
const followsFrom = (c, from) => c.msgs.slice(from).filter((m) => m.type === "follow");
/** Rocket Crew's room as its server keeps it (the TV page's boot snapshot), read with Dad's TV ticket. */
async function seats(captainUrl) {
  const u = new URL(captainUrl);
  const html = await (
    await fetch(`${GAME}/tv/${roomOf(captainUrl)}?t=${u.searchParams.get("tv")}`)
  ).text();
  const boot = html.match(/<script id="boot" type="application\/json">(.*?)<\/script>/)?.[1];
  return JSON.parse(boot ?? "{}").snapshot?.public ?? null;
}
const launcherScreen = () =>
  tv.evaluate(() => document.querySelector(".launcher")?.getAttribute("data-screen") ?? null);
const shoot = (name) =>
  tv.screenshot({ path: join(OUT, `${name}.jpg`), quality: 80 }).catch(() => {});

// --- The run ------------------------------------------------------------------------------------

let detox = null;
let simRec = null;
const simStart = { at: null, file: join(RAW, "mom-phone.mp4") };
try {
  const dad = await person("Dad", "bear");
  const session = await api("/sessions", { token: dad.token, body: { tvName: "Living room TV" } });
  await tv.goto(`${TV}/?api=${encodeURIComponent(API)}&token=${encodeURIComponent(session.token)}`);
  const dadCouch = couchClient(dad.token, session.sessionId);
  await dadCouch.open;
  await until(() => dadCouch.state?.cast, "the TV cast");
  await until(launcherScreen, "the launcher");
  const view = await api(`/sessions/${session.sessionId}`, { token: session.token });
  check("Dad cast the TV (its launcher is up)", true, `TV code ${view.code}`);

  // Juneau's iPad joins the couch with the TV code (no roster is ever sent).
  const juneau = await person("Juneau", "dragon", "tablet");
  await api("/sessions/join", { token: juneau.token, body: { code: view.code } });
  const juneauPad = couchClient(juneau.token, session.sessionId);
  await juneauPad.open;
  const pad = await until(
    () => dadCouch.state?.devices.find((d) => d.profileId === juneau.id && d.online),
    "Juneau's iPad online",
  );
  check("Juneau's iPad joined the couch as a tablet", pad.kind === "tablet", pad.deviceId);

  // Mom's phone (the app) joins the couch with the TV code.
  detox = startDetox();
  setStep("code", { code: view.code });
  await waitStep("joined");
  const mom = await until(
    () => dadCouch.state?.members.find((m) => m.name === "Mom"),
    "Mom on the couch",
  );
  const momDevice = await until(
    () => dadCouch.state?.devices.find((d) => d.profileId === mom.profileId && d.online),
    "Mom's phone online",
  );
  check(
    "Mom's phone joined the couch with the TV code",
    momDevice.kind === "phone",
    momDevice.deviceId,
  );
  await shoot("01-home-two-phones");

  // Dad starts Rocket Crew; his phone page makes the room (the TV doesn't frame it yet).
  dadCouch.send({ type: "game.start", appId: APP_ID, mode: "new", hostDeviceId: dad.deviceId });
  await until(() => dadCouch.state?.current?.appId === APP_ID, "Rocket Crew is on");
  const dadPhone = await gamePhone(dad, session.sessionId, `${GAME}/`);
  await until(() => /\/join\/[A-Z0-9]{4}/.test(dadPhone.url()), "Dad's phone in a room");
  const R = roomOf(dadPhone.url());
  log(`room ${R}`);
  check("the TV hasn't named a room yet", dadCouch.state.current.room === undefined);
  const padStart = await until(
    () => followsFrom(juneauPad, 0).find((f) => f.target.kind === "game"),
    "Juneau's iPad told about the game",
  );
  check(
    "Juneau's iPad follows the game as a player (no roster), with no room yet: it waits like a phone",
    padStart.target.roleId === "player" &&
      padStart.target.appId === APP_ID &&
      padStart.target.room === undefined,
    JSON.stringify(padStart.target),
  );
  setStep("started-no-room");
  await waitStep("still-remote");
  check("Mom's phone waits on the remote until the TV names the room (no new, empty room)", true);

  // The launcher frames Rocket Crew's TV page, which reports ogs:room → game.room.
  const padMark = juneauPad.msgs.length;
  const dadView = await forwardView(dadPhone, dadCouch);
  await until(() => dadCouch.state?.current?.room === R, "the sitting names the room", 30000);
  check("the TV page named its room and the couch's sitting keeps it", true, R);
  await shoot("02-rocket-crew-on-tv");

  const followed = await waitStep("followed");
  check(
    "Mom's phone followed into the TV's room (its WebView is on /join/R)",
    roomOf(followed.url) === R,
    followed.url,
  );
  const seated = await until(async () => {
    const pub = await seats(dadPhone.url());
    return pub?.names?.fixer ? pub : null;
  }, "the Fixer's seat");
  check(
    "Rocket Crew's room has two seats: Dad the Captain, Mom the Fixer (by OGS id)",
    seated.names.captain === "Dad" &&
      seated.names.fixer === "Mom" &&
      seated.seatIds?.captain === dad.id &&
      seated.seatIds?.fixer === mom.profileId,
    JSON.stringify({ names: seated.names, seatIds: seated.seatIds }),
  );
  const sitting = dadCouch.state.current.instanceId;

  // Juneau's iPad was sent the TV's room; it opens the start page with ogsRoom, as the app does.
  const padRoom = await until(
    () => followsFrom(juneauPad, padMark).find((f) => f.target.room),
    "Juneau's iPad told the room",
  );
  check(
    "Juneau's iPad followed into the TV's room as a player",
    padRoom.target.room === R && padRoom.target.roleId === "player",
    JSON.stringify(padRoom.target),
  );
  const juneauPage = await gamePhone(juneau, session.sessionId, roomStartUrl(`${GAME}/`, R));
  await until(() => roomOf(juneauPage.url()) === R, "Juneau's iPad page in room R");
  check("Juneau's iPad page is in room R (no new room)", true, juneauPage.url());
  const aboard = await until(async () => {
    const pub = await seats(dadPhone.url());
    return pub?.seatIds?.lookout ? pub : null;
  }, "Juneau's seat");
  check(
    "Rocket Crew's room R has Juneau's iPad aboard (the Lookout, by OGS id); Mom is still the Fixer",
    aboard.seatIds.lookout === juneau.id && aboard.seatIds.fixer === mom.profileId,
    JSON.stringify({ names: aboard.names, seatIds: aboard.seatIds }),
  );
  // A follower's page that asks for its own TV view (Rocket Crew's Lookout page doesn't; other games'
  // follower pages do) reaches the couch as game.view from that device, as the app forwards it:
  // the session must ignore it.
  const padView = `${GAME}/tv/${R}?t=juneau-ipad`;
  juneauPad.send({ type: "game.view", appId: APP_ID, url: padView });
  dadCouch.send({ type: "game.resume-point", appId: APP_ID, label: "pf-after-ipad-view" });
  await until(() => dadCouch.state?.current?.label === "pf-after-ipad-view", "a later frame");
  check(
    "the iPad's game.view didn't change the TV page (only the host's page counts)",
    dadCouch.state.current.viewUrl === dadView,
    `${dadCouch.state.current.viewUrl} (iPad asked for ${padView})`,
  );
  setStep("seated");

  // Mom steps out to the remote: the TV keeps playing.
  await waitStep("stepped-out");
  await sleep(1500);
  check(
    "Mom stepping out leaves Rocket Crew playing on the TV",
    dadCouch.state.current?.instanceId === sitting && dadCouch.state.screen === "game",
  );

  // Dad presses Home, then Continue: Mom's phone follows back into the same room.
  const padHome = juneauPad.msgs.length;
  dadCouch.send({ type: "home" });
  await until(() => dadCouch.state?.current === null, "Home");
  dadCouch.send({
    type: "game.start",
    appId: APP_ID,
    mode: "continue",
    hostDeviceId: dad.deviceId,
  });
  await until(() => dadCouch.state?.current?.instanceId === sitting, "Continue");
  const padAgain = followsFrom(juneauPad, padHome);
  check(
    "Juneau's iPad was sent to the remote on Home and back into room R on Continue",
    padAgain[0]?.target.kind === "launcher" &&
      padAgain.at(-1)?.target.room === R &&
      padAgain.at(-1)?.target.roleId === "player",
    JSON.stringify(padAgain.map((f) => f.target)),
  );
  check("Continue resumed the same sitting in the same room", dadCouch.state.current.room === R);
  setStep("continued");
  const refollowed = await waitStep("refollowed");
  check(
    "Mom's phone followed Continue back into room R",
    roomOf(refollowed.url) === R,
    refollowed.url,
  );
  const again = await seats(dadPhone.url());
  check(
    "Mom still the Fixer after Continue (no new seat or room)",
    again?.names?.fixer === "Mom" && again?.seatIds?.fixer === mom.profileId,
    JSON.stringify(again?.names),
  );

  // Home on the TV brings Mom's phone (and Juneau's iPad) back to the remote.
  const padLast = juneauPad.msgs.length;
  dadCouch.send({ type: "home" });
  await until(() => dadCouch.state?.current === null, "Home");
  const padBack = await until(
    () => followsFrom(juneauPad, padLast).find((f) => f.target.kind === "launcher"),
    "Juneau's iPad sent home",
  );
  check("Home brought Juneau's iPad back to the remote", Boolean(padBack));
  setStep("home");
  await waitStep("home-done");
  check("Home brought Mom's phone back to the remote", true);
  await shoot("03-home-again");
  check(
    "one cast throughout (no recast)",
    dadCouch.state.casts === 1,
    `casts ${dadCouch.state.casts}`,
  );
} catch (e) {
  check("run finished", false, String(e?.stack ?? e));
} finally {
  setStep("done");
  if (detox) await Promise.race([detox.done, sleep(120000)]);
  if (simRec) {
    const exited = new Promise((r) => simRec.on("exit", r));
    simRec.kill("SIGINT");
    await Promise.race([exited, sleep(15000)]);
  }
}
const tvVideo = tv.video();
const tvEnd = Date.now();
await tvContext.close();
for (const ctx of devices) await ctx.close();
await browser.close();
server.close();

const tiles = [
  simRec ? { file: simStart.file, at: simStart.at, label: "Mom phone (iOS app)" } : null,
  tvVideo ? { file: await tvVideo.path(), end: tvEnd, label: "TV" } : null,
].filter(Boolean);
writeFileSync(join(RAW, "tiles.json"), JSON.stringify(tiles, null, 2));
try {
  const out = join(OUT, "phones-follow.mp4");
  execFileSync("node", ["compose-2x2.mjs", join(RAW, "tiles.json"), out], { stdio: "inherit" });
  check("synced video saved", true, out);
} catch (e) {
  check("synced video saved", false, String(e));
}
writeFileSync(
  join(OUT, "results.json"),
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

// --- Detox + simulator recording ----------------------------------------------------------------
function startDetox() {
  const sim = process.env.DETOX_SIM_NAME;
  if (!sim || !process.env.DETOX_IOS_BINARY)
    throw new Error("set DETOX_SIM_NAME and DETOX_IOS_BINARY");
  const child = spawn(
    "pnpm",
    ["exec", "detox", "test", "--configuration", "ios.sim.release", "e2e/phones-follow.test.ts"],
    {
      cwd: resolve("../apps/mobile"),
      env: { ...process.env, E2E_OGS_API: API, MC_COORD: `http://localhost:${PORT}` },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  const done = new Promise((r) => child.on("exit", (code) => r(code)));
  done.then((code) => check("Detox: Mom's phone test passed", code === 0, `exit ${code}`));
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
