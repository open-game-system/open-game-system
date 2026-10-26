/**
 * The proof video: the phone (its controller on screen; the TV page is rendered hidden and streamed)
 * beside what the TV received, recorded from the received stream itself (MediaRecorder in the
 * receiver page, so the recorder adds no choppiness), with the TV's sound. Fails if the sound is
 * missing or silent.
 *
 *   node proof-video.mjs --sim <udid> | --device <id> --seconds 75 --out dir --final path.mp4
 * Phone side: simctl recordVideo for the Simulator. A real iPhone has no command-line screen capture:
 * pass --phone-video <file> (a QuickTime recording started together with this run) to compose it.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const SIM = arg("sim");
const DEVICE = arg("device");
const SECONDS = Number(arg("seconds", 75));
const OUT = arg("out", "out");
const FINAL = arg("final", join(OUT, "proof.mp4"));
mkdirSync(OUT, { recursive: true });
const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 6).join(" ")}…: ${r.stderr}`);
  return r;
};

let phoneVideo = arg("phone-video");
let rec = null;
let tPhone = Number(arg("phone-start", 0));
if (SIM) {
  phoneVideo = join(OUT, "phone.mp4");
  rec = spawn("xcrun", ["simctl", "io", SIM, "recordVideo", "--codec=h264", "--force", phoneVideo], { stdio: "ignore" });
  tPhone = Date.now() + 400; // recording starts a moment after the command
}
const runStart = Date.now();
const run = spawn("node", ["native-run.mjs", ...(SIM ? ["--sim", SIM] : ["--device", DEVICE, "--phoneCapture", "1"]), "--seconds", String(SECONDS), "--stamp", "0", "--record", "1", "--out", OUT], { stdio: "inherit" });
await new Promise((r) => run.on("exit", r));
if (rec) {
  rec.kill("SIGINT");
  await new Promise((r) => rec.on("exit", r));
}

// A real iPhone: its controller frames (10/s, TV-clock times) from the spike server's SPIKE_FRAMES dir.
const FRAMES = arg("frames");
if (DEVICE && FRAMES) {
  const shots = readdirSync(FRAMES).filter((f) => f.endsWith(".jpg")).map((f) => Number(f.slice(0, -4))).filter((t) => t >= runStart).sort((a, b) => a - b);
  if (shots.length < 10) throw new Error(`only ${shots.length} phone frames in ${FRAMES}`);
  const list = shots.map((t, i) => `file '${FRAMES}/${t}.jpg'\nduration ${((shots[i + 1] ?? t + 100) - t) / 1000}`).join("\n");
  writeFileSync(join(OUT, "phone-frames.txt"), list);
  phoneVideo = join(OUT, "phone.mp4");
  sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(OUT, "phone-frames.txt"), "-vf", "fps=30,scale=-2:900,format=yuv420p", "-c:v", "libx264", phoneVideo]);
  tPhone = shots[0];
}
const tv = join(OUT, "tv-stream.webm");
const summary = JSON.parse(readFileSync(join(OUT, "tv-summary.json"), "utf8"));
const vol = sh("ffmpeg", ["-i", tv, "-vn", "-af", "volumedetect", "-f", "null", "-"]).stderr;
const mean = Number(/mean_volume: (-?[\d.]+) dB/.exec(vol)?.[1] ?? Number.NaN);
if (!(mean > -60)) {
  console.error(`FAIL: the TV stream's sound is missing or silent (mean ${mean} dB)`);
  process.exit(2);
}
// The TV stream starts at summary.recordedAt (wall clock); the phone recording at tPhone.
const lead = phoneVideo && existsSync(phoneVideo) ? (summary.recordedAt - tPhone) / 1000 : 0;
const label = (t) => `drawtext=text='${t}':x=24:y=26:fontsize=26:fontcolor=0xe9e6df`;
const filter =
  `[0:v]trim=start=${Math.max(0, lead).toFixed(2)},setpts=PTS-STARTPTS,scale=-2:900,pad=iw+48:1000:24:76:color=0x16181d,${label("PHONE - controller (TV page hidden)")}[p];` +
  `[1:v]trim=start=${Math.max(0, -lead).toFixed(2)},setpts=PTS-STARTPTS,scale=1280:720,pad=1328:1000:24:76:color=0x16181d,${label("TV - the received WebRTC stream")}[t];` +
  `[1:a]atrim=start=${Math.max(0, -lead).toFixed(2)},asetpts=PTS-STARTPTS[a];` +
  "[p][t]hstack=inputs=2,format=yuv420p[v]";
sh("ffmpeg", ["-y", "-loglevel", "error", "-i", phoneVideo, "-i", tv, "-filter_complex", filter, "-map", "[v]", "-map", "[a]", "-r", "30", "-c:v", "libx264", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", FINAL]);
const outVol = sh("ffmpeg", ["-i", FINAL, "-vn", "-af", "volumedetect", "-f", "null", "-"]).stderr;
const outMean = Number(/mean_volume: (-?[\d.]+) dB/.exec(outVol)?.[1] ?? Number.NaN);
if (!(outMean > -60)) {
  console.error(`FAIL: the video is silent (mean ${outMean} dB)`);
  process.exit(3);
}
console.log(`[proof] TV sound ${mean} dB, video ${outMean} dB → ${FINAL}`);
