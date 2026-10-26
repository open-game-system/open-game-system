/**
 * One recorded run of approach (a): the spike app on the iOS Simulator renders the TV page in its
 * WebView and streams it (canvas + Web Audio over WebRTC) to the Cast receiver page in Chrome.
 * Records the phone (simctl recordVideo, no sound), the TV (Playwright video) and the TV's sound
 * (MediaRecorder on the received audio track), then muxes phone | TV with the TV's audio.
 * Fails loudly if the audio is missing or silent.
 *
 *   node record-run.mjs --sim <udid> --game kite|sender --seconds 45 --out <dir>
 * kite: Kite Count on wrangler dev (KITE_ORIGIN, default :8787) through the spike server, with two
 * Chrome phones that join, start and answer every round.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const SIM = arg("sim");
const GAME = arg("game", "kite");
const SECONDS = Number(arg("seconds", 45));
const OUT = arg("out", "out");
const SERVER = arg("server", "http://192.168.68.113:8797");
const KITE = process.env.KITE_ORIGIN ?? "http://localhost:8787";
/** web: approach (a), the page streams its own canvas; snapstream: (b2), native snapshots of the whole page. */
const MODE = arg("mode", "snapstream");
mkdirSync(OUT, { recursive: true });
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};

const REMUX = process.argv.includes("--remux");
let tvUrl = `${SERVER}/sender.html`;
let phones = null;
let tSim = 0;
let tTv = 0;
if (!REMUX) {
if (GAME === "kite") {
  const res = await fetch(`${KITE}/host`, { redirect: "manual" });
  const loc = new URL(res.headers.get("location"));
  const code = loc.pathname.split("/").pop();
  // (a) needs the proxy (it injects capture.js); (b2) gets it from the app (a WKUserScript).
  tvUrl = MODE === "web" ? `${SERVER}/tv/${code}?t=${loc.searchParams.get("tv")}` : `${KITE}/tv/${code}?t=${loc.searchParams.get("tv")}`;
  phones = { code, host: loc.toString().replace(/^http:\/\/localhost:8787/, KITE) };
  console.log(`[run] room ${code}, TV ${tvUrl}`);
}

// Phone side: the app renders the TV page (visible, so the recording shows it) and streams it.
const rec = spawn("xcrun", ["simctl", "io", SIM, "recordVideo", "--codec=h264", "--force", simVideo], { stdio: "ignore" });
tSim = Date.now();
await new Promise((r) => setTimeout(r, 1000));

// TV side first (it asks for the view), then the phone app.
tTv = Date.now();
const drv = spawn("node", ["receiver-driver.mjs", "--server", SERVER, "--seconds", String(SECONDS), "--out", OUT, "--latency", GAME === "sender" ? "1" : "0"], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((r) => setTimeout(r, 3000));
sh("xcrun", ["simctl", "launch", "--terminate-running-process", SIM, "org.opengame.spike.p2p", "-mode", MODE, "-place", "visible", "-inflight", "4", "-url", tvUrl]);
let drvOut = "";
drv.stdout.on("data", (d) => {
  drvOut += d;
  process.stdout.write(d);
});

// Two Chrome phones play Kite Count.
let browser;
if (phones) {
  browser = await chromium.launch();
  const play = async (name, starter) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    if (starter) await page.goto(phones.host);
    else await page.goto(`${KITE}/join/${phones.code}`);
    await page.getByTestId("nameField").fill(name);
    await page.getByTestId("joinButton").click();
    return page;
  };
  const p1 = await play("Jon", true);
  console.log("[run] phone 1 joined");
  await new Promise((r) => setTimeout(r, 6000));
  const p2 = await play("Juneau", false);
  await new Promise((r) => setTimeout(r, 3000));
  await p1.getByText("Juneau").first().waitFor({ timeout: 20_000 }).catch(() => {});
  for (let i = 0; i < 5; i++) {
    await p1.getByTestId("startButton").click({ timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    const text = await p1.locator("body").innerText();
    if (!/Start/.test(text) || /Watch the TV/.test(text)) break;
  }
  console.log("[run] game started:", (await p1.locator("body").innerText()).replace(/\n/g, " | ").slice(0, 80));
  const until = Date.now() + SECONDS * 1000;
  (async () => {
    while (Date.now() < until) {
      for (const p of [p1, p2]) {
        const choices = p.locator("[data-testid^=pick-]:not([disabled])");
        const n = await choices.count().catch(() => 0);
        if (n) await choices.nth(Math.floor(Math.random() * n)).click({ timeout: 500 }).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  })();
}

await new Promise((r) => drv.on("exit", r));
spawnSync("xcrun", ["simctl", "terminate", SIM, "org.opengame.spike.p2p"]);
rec.kill("SIGINT");
await new Promise((r) => rec.on("exit", r));
await browser?.close();
}
const simVideo = join(OUT, "phone.mp4");

// Mux: phone | TV, TV audio. Offsets: the TV video starts at tTv, its audio at the first frame.
const tvVideo = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "tv-audio.webm");
const summary = JSON.parse(readFileSync(join(OUT, "tv-summary.json"), "utf8"));
// MediaRecorder's WebM has no duration: decode it to WAV first, then place it with adelay.
const audio = join(OUT, "tv-audio.wav");
sh("ffmpeg", ["-y", "-loglevel", "error", "-i", join(OUT, "tv-audio.webm"), "-c:a", "pcm_s16le", audio]);
const vol = spawnSync("ffmpeg", ["-i", audio, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const mean = Number(/mean_volume: (-?[\d.]+) dB/.exec(vol)?.[1] ?? Number.NaN);
if (!summary.audioTracks || !(mean > -60)) {
  console.error(`FAIL: no TV audio (tracks ${summary.audioTracks}, mean volume ${mean} dB)`);
  process.exit(2);
}
// Line the two clips up by picture content (the phone shows the same page): the clocks of the two
// recorders start at unknown moments. The TV's audio starts at its first frame.
const [offset, err] = sh("python3", ["-I", "align.py", simVideo, join(OUT, tvVideo)]).trim().split(" ").map(Number);
console.log(`[run] TV clip starts ${offset} s into the phone clip (match error ${err})`);
const tvLead = offset;
const audioAt = tvLead + 0.2 + summary.firstFrameMs / 1000;
const final = join(OUT, `p2p-cast-${GAME}.mp4`);
sh("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", simVideo,
  "-itsoffset", String(tvLead), "-i", join(OUT, tvVideo),
  "-i", audio,
  "-filter_complex",
  "[0:v]scale=-2:900,pad=iw+40:1000:20:70:color=0x16181d,drawtext=text='PHONE (iOS Simulator) renders it':x=20:y=25:fontsize=24:fontcolor=0xe9e6df[p];" +
    "[1:v]scale=1280:720,pad=1320:1000:20:70:color=0x16181d,drawtext=text='TV (Cast receiver page in Chrome) plays the WebRTC stream':x=20:y=25:fontsize=24:fontcolor=0xe9e6df[t];" +
    "[p][t]hstack=inputs=2,format=yuv420p[v];" +
    `[2:a]adelay=${Math.round(audioAt * 1000)}:all=1[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "22", "-c:a", "aac", "-b:a", "160k",
  "-t", String(tvLead + SECONDS + 3), "-movflags", "+faststart", final,
]);
const outVol = spawnSync("ffmpeg", ["-i", final, "-vn", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const outMean = Number(/mean_volume: (-?[\d.]+) dB/.exec(outVol)?.[1] ?? Number.NaN);
if (!(outMean > -60)) {
  console.error(`FAIL: the muxed video is silent (mean ${outMean} dB)`);
  process.exit(3);
}
if (!REMUX) writeFileSync(join(OUT, "timing.json"), JSON.stringify({ tSim, tTv, tvLead, audioAt }));
console.log(`[run] TV audio mean ${mean} dB, muxed ${outMean} dB; video ${final}`);
