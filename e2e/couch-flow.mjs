// Cross-surface flow against the real local API + the real TV launcher (via the fake Chromecast):
// Jonathan's phone, Mom's phone and both kid iPads are WebSocket clients (each its own OGS profile);
// the TV is a recorded browser. Proves the acceptance scenarios that span devices: casting starts a
// session owned by Jonathan, the others join with the TV code, cast once, launch, game.view framed,
// kids follow by profile, swipe back (home) suspends with the resume point, swap with 0 recasts, Continue
// resumes the same sitting, remote handoff.
//
// Needs running: API (OGS_API, 8788), launcher (OGS_TV, 5180), fake Chromecast (FAKE_CAST, 5181),
// fixture game (5190).
//   node couch-flow.mjs
import { writeFileSync } from "node:fs";
import WebSocket from "ws";

const API = process.env.OGS_API ?? "http://localhost:8788";
const TV = process.env.OGS_TV ?? "http://localhost:5180";
const CAST = process.env.FAKE_CAST ?? "http://localhost:5181";
const GAME = process.env.FIXTURE_GAME ?? "http://localhost:5190";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function client(name, token, session) {
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

async function until(fn, what, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = fn();
    if (v) return v;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function screenshot(name) {
  const res = await fetch(`${CAST}/screenshot`);
  if (res.ok) writeFileSync(`evidence/couch-${name}.png`, Buffer.from(await res.arrayBuffer()));
}

const tv = (game, label) => `${GAME}/tv?game=${encodeURIComponent(game)}&label=${encodeURIComponent(label)}`;

try {
  const run = Date.now().toString(36);
  const make = async (name, sticker, kind, deviceId) =>
    post("/api/v1/profiles", { name, handle: `${name.toLowerCase()}.${run}`.slice(0, 24), sticker, device: { deviceId, kind, name: `${name}'s ${kind}` } });
  const dadP = await make("Jonathan", "bear", "phone", "e2e-phone-dad");
  const momP = await make("Mom", "owl", "phone", "e2e-phone-mom");
  const juneauP = await make("Juneau", "dragon", "tablet", "e2e-ipad-juneau");
  const avaP = await make("Ava", "dinosaur", "tablet", "e2e-ipad-ava");
  const [dad, juneau, ava] = [dadP.profile, juneauP.profile, avaP.profile];
  check("four profiles made, one per device", [dadP, momP, juneauP, avaP].every((p) => p.token));

  // Jonathan casts: a session he hosts, with a TV code; the others join with it.
  const session = await post("/api/v1/sessions", { tvName: "Living room TV" }, dadP.token);
  for (const p of [momP, juneauP, avaP]) await post("/api/v1/sessions/join", { code: session.code }, p.token);
  check("cast starts a session owned by Jonathan; the others join with the TV code", session.host.id === dad.id && /^[A-Z2-9]{6}$/.test(session.code));
  const launcherT = session.token;

  // Members are listed in the order they come onto the couch, so each device connects in turn.
  const phone = client("phone", dadP.token, session.sessionId);
  await phone.open;
  await until(() => phone.state?.members?.length === 1, "Jonathan on the couch");
  const arrive = async (name, token, n) => {
    const c = client(name, token, session.sessionId);
    await c.open;
    await until(() => phone.state?.members?.length === n, `${name} on the couch`);
    return c;
  };
  const momPhone = await arrive("mom", momP.token, 2);
  const kid1 = await arrive("juneau", juneauP.token, 3);
  const kid2 = await arrive("ava", avaP.token, 4);
  check("the couch is who joined", phone.state.members.map((m) => m.name).join(",") === "Jonathan,Mom,Juneau,Ava", phone.state.members.map((m) => m.name).join(","));

  // Cast once: the fake Chromecast opens the launcher URL in its TV browser. Its load counter lives
  // as long as the server, so this run counts from here.
  const loadsBefore = (await (await fetch(`${CAST}/status`)).json()).loads;
  await fetch(`${CAST}/load`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ viewUrl: `${TV}/?api=${encodeURIComponent(API)}&token=${encodeURIComponent(launcherT)}` }) });
  await until(() => phone.state?.cast, "launcher to connect", 20000);
  check("cast from the TV tab: launcher connected, exactly 1 cast", phone.state.casts === 1, `casts=${phone.state.casts}`);
  await sleep(1500);
  await screenshot("01-launcher-home");

  // Remote: the launcher owns its layout; a move comes back as focus.set.
  const before = phone.state.focus;
  phone.send({ type: "focus.move", dir: "right" });
  await until(() => phone.state.focus && phone.state.focus !== before, "focus to move");
  check("remote right moves the TV focus ring", phone.state.focus !== before, `${before} -> ${phone.state.focus}`);
  await screenshot("02-focus-moved");

  // Launch Rocket Crew from the phone; the game's phone page asks for its TV view.
  const roster = [
    { profileId: dad.id, roleId: "captain" },
    { profileId: juneau.id, roleId: "fixer" },
    { profileId: ava.id, roleId: "helper" },
  ];
  phone.send({ type: "game.start", appId: "rocket-crew", mode: "continue", roster, hostDeviceId: "e2e-phone-dad" });
  await until(() => phone.state.screen === "game", "game screen");
  phone.send({ type: "game.view", appId: "rocket-crew", url: tv("Rocket Crew", "Mission 6") });
  await until(() => phone.state.current?.viewUrl, "game view");
  const followJ = await until(() => kid1.msgs.find((m) => m.type === "follow" && m.target.kind === "game"), "Juneau's follow");
  const followA = await until(() => kid2.msgs.find((m) => m.type === "follow" && m.target.kind === "game"), "Ava's follow");
  check("kid iPads follow by profile with their roles", followJ.target.roleId === "fixer" && followA.target.roleId === "helper");
  await until(() => phone.state.current?.label === "Mission 6", "resume point from the framed game", 10000)
    .then(() => check("launcher framed the game and forwarded its resume point", true, "Mission 6"))
    .catch((e) => check("launcher framed the game and forwarded its resume point", false, e.message));
  await sleep(1200);
  await screenshot("03-rocket-crew-framed");

  // Swipe back = home: suspended with its resume point, kids back to the launcher.
  const rcInstance = phone.state.current.instanceId;
  phone.send({ type: "home" });
  await until(() => phone.state.screen === "home", "home");
  check("swipe back suspends the game with its resume point", phone.state.suspended[0]?.label === "Mission 6");
  await sleep(1200);
  await screenshot("04-home-suspended");

  // Swap to Bake Shop in the same stream.
  phone.send({ type: "game.start", appId: "bake-shop", mode: "continue", roster, hostDeviceId: "e2e-phone-dad" });
  phone.send({ type: "game.view", appId: "bake-shop", url: tv("Bake Shop", "Day 4") });
  await until(() => phone.state.current?.appId === "bake-shop" && phone.state.current.viewUrl, "Bake Shop framed");
  const status = await (await fetch(`${CAST}/status`)).json();
  const loads = status.loads - loadsBefore;
  check("swap: zero recasts (session casts=1, Chromecast loads=1)", phone.state.casts === 1 && loads === 1, `casts=${phone.state.casts} loads=${loads}`);
  await sleep(1500);
  await screenshot("05-bake-shop-framed");

  // Continue resumes the same sitting.
  phone.send({ type: "game.start", appId: "rocket-crew", mode: "continue" });
  await until(() => phone.state.current?.appId === "rocket-crew", "Rocket Crew again");
  check("Continue resumes the same instance and label", phone.state.current.instanceId === rcInstance && phone.state.current.label === "Mission 6");

  // The remote phone goes dark: Mom is offered the remote.
  phone.ws.close();
  const offer = await until(() => momPhone.msgs.find((m) => m.type === "remote.offer"), "remote offer");
  check("remote phone dark: Mom's phone is offered the remote", offer.from === "e2e-phone-dad");

  await fetch(`${CAST}/stop`, { method: "POST" });
  for (const c of [momPhone, kid1, kid2]) c.ws.close();
} catch (e) {
  check("flow completed", false, String(e));
}

writeFileSync("evidence/couch-flow.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
