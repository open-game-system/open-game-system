// Cross-surface flow against the real local API + the real TV launcher (via the fake Chromecast):
// the phone, Mom's phone and both kid iPads are WebSocket clients; the TV is a recorded browser.
// Proves the acceptance scenarios that span devices: cast once, launch, game.view framed, kids
// follow by name, swipe back (home) suspends with the resume point, swap with 0 recasts, Continue
// resumes the same sitting, remote handoff.
//
// Needs running: API (8787), launcher (5180), fake Chromecast (5181), fixture game (5190).
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

function client(name, token) {
  const ws = new WebSocket(`${API.replace(/^http/, "ws")}/api/v1/couch/ws?token=${encodeURIComponent(token)}`);
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
  const hh = await post("/api/v1/households", {
    name: "The Mumms",
    people: [
      { name: "Jonathan", band: "grownup", sticker: "bear" },
      { name: "Mom", band: "grownup", sticker: "owl" },
      { name: "Juneau", band: "kid", sticker: "dragon" },
      { name: "Ava", band: "little", sticker: "dinosaur" },
    ],
    device: { deviceId: "e2e-phone-dad", kind: "phone", name: "Jonathan's iPhone", personIndex: 0 },
  });
  const [dad, mom, juneau, ava] = hh.people;
  check("household created with 4 people", hh.householdId && hh.people.length === 4);
  const hid = hh.householdId;
  const pair = (deviceId, kind, personId, name) => post(`/api/v1/households/${hid}/devices`, { deviceId, kind, personId, name }, hh.token);
  const momT = (await pair("e2e-phone-mom", "phone", mom.id, "Mom's iPhone")).token;
  const juneauT = (await pair("e2e-ipad-juneau", "tablet", juneau.id, "Juneau's iPad")).token;
  const avaT = (await pair("e2e-ipad-ava", "tablet", ava.id, "Ava's iPad")).token;
  const launcherT = (await post(`/api/v1/households/${hid}/launcher-token`, {}, hh.token)).token;

  const phone = client("phone", hh.token);
  const momPhone = client("mom", momT);
  const kid1 = client("juneau", juneauT);
  const kid2 = client("ava", avaT);
  await Promise.all([phone.open, momPhone.open, kid1.open, kid2.open]);

  // Cast once: the fake Chromecast opens the launcher URL in its TV browser.
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
    { personId: dad.id, roleId: "captain" },
    { personId: juneau.id, roleId: "fixer" },
    { personId: ava.id, roleId: "helper" },
  ];
  phone.send({ type: "game.start", appId: "rocket-crew", mode: "continue", roster, hostDeviceId: "e2e-phone-dad" });
  await until(() => phone.state.screen === "game", "game screen");
  phone.send({ type: "game.view", appId: "rocket-crew", url: tv("Rocket Crew", "Mission 6") });
  await until(() => phone.state.current?.viewUrl, "game view");
  const followJ = await until(() => kid1.msgs.find((m) => m.type === "follow" && m.target.kind === "game"), "Juneau's follow");
  const followA = await until(() => kid2.msgs.find((m) => m.type === "follow" && m.target.kind === "game"), "Ava's follow");
  check("kid iPads follow by name with their roles", followJ.target.roleId === "fixer" && followA.target.roleId === "helper");
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
  check("swap: zero recasts (session casts=1, Chromecast loads=1)", phone.state.casts === 1 && status.loads === 1, `casts=${phone.state.casts} loads=${status.loads}`);
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
