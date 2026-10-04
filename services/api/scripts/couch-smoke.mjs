// Smoke test of the couch WebSocket against a running API: node scripts/couch-smoke.mjs <api base, e.g. http://127.0.0.1:8787/api/v1> <phone token> <launcher token>
const [api, phoneToken, launcherToken] = process.argv.slice(2);
const ws = (t) =>
  new WebSocket(`${api.replace(/^http/, "ws")}/couch/ws?token=${encodeURIComponent(t)}`);
const open = (s) => new Promise((r) => s.addEventListener("open", r));
const phone = ws(phoneToken);
await open(phone);
const tv = ws(launcherToken);
tv.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.type === "state")
    console.log(
      "tv state:",
      m.state.screen,
      "casts",
      m.state.casts,
      "current",
      m.state.current?.appId ?? "-",
      "view",
      m.state.current?.viewUrl ?? "-",
    );
  else console.log("tv:", e.data);
});
phone.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.type !== "state") console.log("phone:", e.data);
});
await open(tv);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(200);
phone.send(JSON.stringify({ type: "game.start", appId: "rocket-crew", mode: "new" }));
await wait(200);
phone.send(
  JSON.stringify({
    type: "game.view",
    appId: "rocket-crew",
    url: "https://rocket-crew.jonathanrmumm.workers.dev/tv/ROOM1",
  }),
);
await wait(200);
phone.send(JSON.stringify({ type: "home" }));
await wait(200);
phone.close();
tv.close();
await wait(100);
process.exit(0);
