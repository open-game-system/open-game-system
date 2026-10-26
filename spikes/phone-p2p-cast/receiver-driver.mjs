/**
 * The TV side of the spike: Chrome on the Mac opens the real Cast receiver page
 * (apps/web/public/receiver.html?signal=test, the laptop/peer path), bridged to the signaling relay
 * (standing in for the Cast namespace). It measures what the TV gets: received fps, jitter, freezes,
 * the jitter buffer, and glass-to-glass latency from the sender's timestamp blocks (decoded from each
 * presented frame; sender and receiver share the Mac's clock in the Simulator). Records the TV screen
 * (Playwright video) and the TV's audio (MediaRecorder on the received audio track) separately.
 *
 *   node receiver-driver.mjs --server http://192.168.68.113:8797 --seconds 30 --out dir [--label lite]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import WebSocket from "ws";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const SERVER = arg("server", "http://192.168.68.113:8797");
const SECONDS = Number(arg("seconds", 30));
const OUT = arg("out", "out");
const LATENCY = arg("latency", "1") === "1";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=metal"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
await ctx.route("https://www.gstatic.com/cast/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
const rxEvents = [];
await ctx.route("https://opengame-api.jonathanrmumm.workers.dev/**", (r) => {
  try {
    for (const e of JSON.parse(r.request().postData() ?? "{}").events ?? []) rxEvents.push(e);
  } catch {}
  return r.fulfill({ status: 202, body: "{}" });
});
const page = await ctx.newPage();
const ws = new WebSocket(`${SERVER.replace(/^http/, "ws")}/ws?role=tv`);
await new Promise((r) => ws.on("open", r));
await page.exposeFunction("__toPhone", (m) => ws.send(JSON.stringify(m)));
await page.addInitScript(() => {
  window.__ogsSignalOut = (m) => window.__toPhone(m);
});
const phoneLogs = [];
ws.on("message", (raw) => {
  const m = JSON.parse(String(raw));
  if (m.type === "LOG") {
    phoneLogs.push(m.message);
    console.log("[phone]", m.message);
    return;
  }
  page.evaluate((d) => window.__ogsSignalIn?.(d), m).catch(() => {});
});
const t0 = Date.now();
await page.goto(`${SERVER}/receiver.html?signal=test&statsEvery=${arg("statsEvery", "30000")}`);
await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2, null, { timeout: 60_000 });
const firstFrameMs = Date.now() - t0;
console.log(`[tv] first frame after ${firstFrameMs} ms`);

// Latency probe + audio recorder in the page.
await page.evaluate((latency) => {
  const v = document.querySelector("video");
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 48;
  const x = c.getContext("2d", { willReadFrequently: true });
  window.__lat = [];
  if (latency) {
    const tick = () => {
      x.drawImage(v, 0, 0, v.videoWidth, 48 * (v.videoHeight / 720), 0, 0, 1280, 48);
      const px = x.getImageData(0, 0, 1280, 48).data;
      let ts = 0;
      let parity = 0;
      let bits = [];
      for (let b = 0; b < 25; b++) {
        const i = (24 * 1280 + b * 48 + 24) * 4;
        bits.push(px[i] + px[i + 1] + px[i + 2] > 384 ? 1 : 0);
      }
      for (let b = 0; b < 24; b++) {
        ts = ts * 2 + bits[b];
        parity ^= bits[b];
      }
      if (parity === bits[24]) {
        const d = (Date.now() % 16777216) - ts;
        const lat = (d + 16777216) % 16777216;
        if (lat < 5000) window.__lat.push(lat);
      }
      v.requestVideoFrameCallback(tick);
    };
    v.requestVideoFrameCallback(tick);
  }
  const audio = v.srcObject.getAudioTracks();
  window.__audioTracks = audio.length;
  if (audio.length) {
    const rec = new MediaRecorder(new MediaStream(audio), { mimeType: "audio/webm" });
    window.__chunks = [];
    rec.ondataavailable = (e) => window.__chunks.push(e.data);
    rec.start(1000);
    window.__rec = rec;
  }
}, LATENCY);

const samples = [];
let last = null;
for (let s = 0; s < SECONDS; s++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(async () => {
    const out = {};
    (await window.receiverPc.getStats()).forEach((r) => {
      if (r.type === "inbound-rtp" && r.kind === "video")
        Object.assign(out, {
          frames: r.framesDecoded, dropped: r.framesDropped, freezes: r.freezeCount, jitter: r.jitter,
          jbDelay: r.jitterBufferDelay, jbCount: r.jitterBufferEmittedCount, w: r.frameWidth, h: r.frameHeight,
          decoder: r.decoderImplementation, lost: r.packetsLost, nack: r.nackCount, pli: r.pliCount,
        });
      if (r.type === "inbound-rtp" && r.kind === "audio") out.audioEnergy = r.totalAudioEnergy;
      if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") out.rttMs = Math.round((r.currentRoundTripTime || 0) * 1000);
    });
    return out;
  });
  if (last) samples.push({ fps: st.frames - last.frames, ...st });
  last = st;
}
const lat = await page.evaluate(() => window.__lat);
const audioTracks = await page.evaluate(() => window.__audioTracks);
const audioB64 = await page.evaluate(async () => {
  if (!window.__rec) return null;
  window.__rec.stop();
  await new Promise((r) => setTimeout(r, 500));
  const buf = await new Blob(window.__chunks, { type: "audio/webm" }).arrayBuffer();
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
});
if (audioB64) writeFileSync(`${OUT}/tv-audio.webm`, Buffer.from(audioB64, "base64"));
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
};
const fpsList = samples.map((s) => s.fps);
const lastS = samples.at(-1) ?? {};
const summary = {
  firstFrameMs,
  seconds: SECONDS,
  receivedFps: { p50: pct(fpsList, 0.5), min: Math.min(...fpsList) },
  size: `${lastS.w}x${lastS.h}`,
  decoder: lastS.decoder,
  jitterMs: Math.round((lastS.jitter ?? 0) * 1000),
  jitterBufferMs: lastS.jbCount ? Math.round((lastS.jbDelay / lastS.jbCount) * 1000) : null,
  freezes: lastS.freezes,
  dropped: lastS.dropped,
  lost: lastS.lost,
  rttMs: lastS.rttMs,
  audioTracks,
  audioEnergy: lastS.audioEnergy,
  glassToGlassMs: lat.length ? { n: lat.length, p50: pct(lat, 0.5), p90: pct(lat, 0.9), min: Math.min(...lat) } : null,
  phone: phoneLogs,
  receiverPeerStats: rxEvents.filter((e) => e.name === "receiver.peer.stats").map((e) => e.data),
};
writeFileSync(`${OUT}/tv-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
const video = page.video();
await ctx.close();
await browser.close();
ws.close();
console.log("[tv] video", await video.path());
