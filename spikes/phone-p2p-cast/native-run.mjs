/**
 * One measured run of the native path: Kite Count on wrangler dev (LAN), a Chrome "host" phone that
 * starts every game and answers, the spike app on the iPhone (or the Simulator) showing its
 * controller while its hidden WebView renders the TV page and libwebrtc streams it, and the Chrome
 * receiver measuring at the TV side (receiver-driver.mjs). Writes tv-summary.json, phone-metrics.json
 * and summary.json to --out.
 *
 *   node native-run.mjs --device <iPhone id> | --sim <udid>  --seconds 300 --out dir [--stamp 1] [--record 1]
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const DEVICE = arg("device");
const SIM = arg("sim");
const SECONDS = Number(arg("seconds", 300));
const OUT = arg("out", "out");
const STAMP = arg("stamp", "1");
const RECORD = arg("record", "0");
const LAN = arg("lan", "192.168.68.113");
const SERVER = `http://${LAN}:8797`;
const KITE = `http://${LAN}:8787`;
mkdirSync(OUT, { recursive: true });
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}: ${r.stderr || r.stdout}`);
  return r.stdout;
};

const res = await fetch(`${KITE}/host`, { redirect: "manual" });
const loc = new URL(res.headers.get("location"));
const code = loc.pathname.split("/").pop();
const tvUrl = `${KITE}/tv/${code}?t=${loc.searchParams.get("tv")}`;
console.log(`[run] room ${code}`);
const metricsFrom = Date.now();

// The TV (receiver) first: it asks for the view.
const drv = spawn("node", ["receiver-driver.mjs", "--server", SERVER, "--seconds", String(SECONDS), "--out", OUT, "--latency", STAMP, "--record", RECORD, "--buffer", arg("buffer", "50"), ...(arg("channel") ? ["--channel", arg("channel")] : [])], { stdio: ["ignore", "pipe", "inherit"] });
drv.stdout.on("data", (d) => process.stdout.write(d));

// The host phone (Chrome): joins first, so it is the one that starts.
const browser = await chromium.launch();
const host = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await host.goto(loc.toString());
await host.getByTestId("nameField").fill("Mom");
await host.getByTestId("joinButton").click();

// The iPhone (or Simulator): the spike app, its controller joining as the second player.
const appArgs = ["-mode", "native", "-tv", tvUrl, "-controller", `${KITE}/join/${code}`, "-name", "Jon", "-server", SERVER, "-stamp", STAMP, "-codec", arg("codec", "H264"), "-phoneCapture", arg("phoneCapture", "0")];
await new Promise((r) => setTimeout(r, 2500));
if (DEVICE) {
  sh("xcrun", ["devicectl", "device", "process", "launch", "--device", DEVICE, "--terminate-existing", "org.opengame.spike.p2p", "--", ...appArgs]);
} else {
  sh("xcrun", ["simctl", "launch", "--terminate-running-process", SIM, "org.opengame.spike.p2p", ...appArgs]);
}
const appAt = Date.now();

// The host plays: starts each game once the iPhone has joined, answers, starts again after the last round.
const until = Date.now() + (SECONDS + 60) * 1000;
let games = 0;
(async () => {
  while (Date.now() < until) {
    const start = host.getByTestId("startButton");
    if (host.isClosed()) break;
    if ((await start.count().catch(() => 0)) && (await host.getByText("Jon").count().catch(() => 0))) {
      await start.click({ timeout: 2000 }).then(() => games++, () => {});
    }
    const picks = host.locator("[data-testid^=pick-]:not([disabled])");
    const n = await picks.count().catch(() => 0);
    if (n) await picks.nth(Math.floor(Math.random() * n)).click({ timeout: 1000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));
  }
})();

await new Promise((r) => drv.on("exit", r));
const phone = (await (await fetch(`${SERVER}/metrics`)).json()).filter((m) => m.role === "phone-native" && m.at >= metricsFrom);
writeFileSync(join(OUT, "phone-metrics.json"), JSON.stringify(phone, null, 2));
if (DEVICE) spawnSync("xcrun", ["devicectl", "device", "process", "terminate", "--device", DEVICE, "--name", "P2PSpike"]);
else spawnSync("xcrun", ["simctl", "terminate", SIM, "org.opengame.spike.p2p"]);
await browser.close();

const tv = JSON.parse(readFileSync(join(OUT, "tv-summary.json"), "utf8"));
const med = (k) => {
  const v = phone.map((m) => m[k]).filter((x) => typeof x === "number").sort((a, b) => a - b);
  return v.length ? Math.round(v[Math.floor(v.length / 2)] * 10) / 10 : null;
};
const summary = {
  where: DEVICE ? `iPhone ${DEVICE}` : `Simulator ${SIM}`,
  games,
  appLaunchedAt: appAt,
  tv: (({ phone: _p, receiverPeerStats: _r, ...t }) => t)(tv),
  phone: {
    samples: phone.length,
    capturedFps: med("capturedFps"),
    droppedPerS: med("droppedPerS"),
    snapshotMsP50: med("snapshotMsP50"),
    renderMsP50: med("renderMsP50"),
    encodedFps: med("encodedFps"),
    encodeMsPerFrame: med("encodeMsPerFrame"),
    kbps: med("kbps"),
    appCpuPercent: med("appCpuPercent"),
    encoder: phone.at(-1)?.encoder,
    size: phone.at(-1)?.size,
    limit: phone.at(-1)?.limit,
    thermalStart: phone[0]?.thermal,
    thermalEnd: phone.at(-1)?.thermal,
    batteryStart: phone[0]?.battery,
    batteryEnd: phone.at(-1)?.battery,
    audioUnderruns: phone.at(-1)?.audioUnderruns,
  },
  targets: {
    "fps p50 >= 29": tv.receivedFps.p50 >= 29,
    "frame interval p95 <= 45 ms": tv.frameIntervalMs.p95 <= 45,
    "0 freezes": tv.freezes === 0,
    "glass-to-glass p50 <= 150 ms": tv.glassToGlassMs ? tv.glassToGlassMs.p50 <= 150 : null,
  },
};
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
