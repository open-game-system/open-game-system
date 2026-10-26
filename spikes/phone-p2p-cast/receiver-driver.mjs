/**
 * The TV side of the spike: Chrome on the Mac opens the real Cast receiver page
 * (apps/web/public/receiver.html?signal=test, its peer path), bridged to the spike's signaling relay
 * (standing in for the Cast namespace). Measures what the TV gets, from the receiver's own getStats
 * and from each presented frame (requestVideoFrameCallback):
 *  - received fps per second (p50, min), frame-interval p50/p95/max, freezes (Chrome's freezeCount),
 *  - jitter, jitter-buffer delay, RTT, decoder,
 *  - glass-to-glass from the sender's timestamp blocks (sender clock synced to the server's),
 *  - with --record: the received stream itself (video + audio) via MediaRecorder, so the recorder adds
 *    no choppiness of its own; else the TV audio only.
 *
 *   node receiver-driver.mjs --server http://192.168.68.113:8797 --seconds 300 --out dir
 *        [--buffer 50] [--latency 1] [--record 1] [--statsEvery 30000]
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
const RECORD = arg("record", "0") === "1";
const BUFFER = arg("buffer", "50");
mkdirSync(OUT, { recursive: true });

// Headed by default: a real window composited at the display's refresh, like a TV. Headless Chrome's
// frame scheduler isn't vsync-paced, so its presentation intervals are noise (p95 67 ms even for a
// perfect local 30 fps source).
const browser = await chromium.launch({
  headless: arg("headed", "1") !== "1",
  ...(arg("channel") ? { channel: arg("channel") } : {}),
  args: ["--autoplay-policy=no-user-gesture-required", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
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
await page.goto(`${SERVER}/receiver.html?signal=test&buffer=${BUFFER}&statsEvery=${arg("statsEvery", "30000")}`);
await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2, null, { timeout: 120_000 });
const firstFrameMs = Date.now() - t0;
console.log(`[tv] first frame after ${firstFrameMs} ms`);

await page.evaluate(
  ({ latency, record }) => {
    const v = document.querySelector("video");
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 48;
    const x = c.getContext("2d", { willReadFrequently: true });
    window.__lat = [];
    window.__intervals = [];
    let last = null;
    window.__rtpIntervals = [];
    window.__recvIntervals = [];
    let lastRtp = null;
    let lastRecv = null;
    const tick = (now, meta) => {
      if (last !== null) window.__intervals.push(now - last);
      last = now;
      // presentedFrames counts what the compositor showed; a jump > 1 means a callback was skipped
      // (the measurement missed a frame the TV did show).
      if (meta && window.__lastPresented != null) {
        const d = meta.presentedFrames - window.__lastPresented;
        window.__presentedJumps = (window.__presentedJumps || 0) + (d > 1 ? d - 1 : 0);
      }
      if (meta) window.__lastPresented = meta.presentedFrames;
      // The sender's cadence (RTP timestamps, 90 kHz) and the network's (receive times), to tell a
      // phone that sends unevenly from a TV that presents unevenly.
      if (meta && meta.rtpTimestamp != null) {
        if (lastRtp !== null) window.__rtpIntervals.push(((meta.rtpTimestamp - lastRtp + 4294967296) % 4294967296) / 90);
        lastRtp = meta.rtpTimestamp;
      }
      if (meta && meta.receiveTime != null) {
        if (lastRecv !== null) window.__recvIntervals.push(meta.receiveTime - lastRecv);
        lastRecv = meta.receiveTime;
      }
      if (latency) {
        x.drawImage(v, 0, 0, v.videoWidth, 48 * (v.videoHeight / 720), 0, 0, 1280, 48);
        const px = x.getImageData(0, 0, 1280, 48).data;
        const bits = [];
        for (let b = 0; b < 25; b++) {
          const i = (24 * 1280 + b * 48 + 24) * 4;
          bits.push(px[i] + px[i + 1] + px[i + 2] > 384 ? 1 : 0);
        }
        let ts = 0;
        let parity = 0;
        for (let b = 0; b < 24; b++) {
          ts = ts * 2 + bits[b];
          parity ^= bits[b];
        }
        if (parity === bits[24]) {
          const lat = ((Date.now() % 16777216) - ts + 16777216) % 16777216;
          if (lat < 5000) window.__lat.push(lat);
        }
      }
      v.requestVideoFrameCallback(tick);
    };
    // With the receiver's smooth presenter, what the TV shows is its canvas: measure there instead.
    const smooth = document.body.classList.contains("smooth");
    window.__measuredOn = smooth ? "presenter-canvas" : "video";
    if (smooth) {
      let lastP = null;
      window.__onPresent = (canvas, now) => {
        if (lastP !== null) window.__intervals.push(now - lastP);
        lastP = now;
        if (!latency) return;
        const px = canvas.getContext("2d").getImageData(0, 0, canvas.width, 48 * (canvas.height / 720)).data;
        const w = canvas.width;
        const sx = w / 1280;
        const bits = [];
        for (let b = 0; b < 25; b++) {
          const i = (Math.round(24 * sx) * w + Math.round((b * 48 + 24) * sx)) * 4;
          bits.push(px[i] + px[i + 1] + px[i + 2] > 384 ? 1 : 0);
        }
        let ts = 0;
        let parity = 0;
        for (let b = 0; b < 24; b++) {
          ts = ts * 2 + bits[b];
          parity ^= bits[b];
        }
        if (parity === bits[24]) {
          const lat = ((Date.now() % 16777216) - ts + 16777216) % 16777216;
          if (lat < 5000) window.__lat.push(lat);
        }
      };
    } else v.requestVideoFrameCallback(tick);
    const stream = v.srcObject;
    window.__audioTracks = stream.getAudioTracks().length;
    const tracks = record ? stream.getTracks() : stream.getAudioTracks();
    if (tracks.length) {
      const mimeType = record ? "video/webm;codecs=vp9,opus" : "audio/webm";
      const rec = new MediaRecorder(new MediaStream(tracks), { mimeType, videoBitsPerSecond: 12_000_000 });
      window.__chunks = [];
      rec.ondataavailable = (e) => window.__chunks.push(e.data);
      rec.start(1000);
      window.__rec = rec;
      window.__recAt = Date.now();
    }
  },
  { latency: LATENCY, record: RECORD },
);

const samples = [];
let last = null;
for (let s = 0; s < SECONDS; s++) {
  await page.waitForTimeout(1000);
  const st = await page.evaluate(async () => {
    const out = {};
    (await window.receiverPc.getStats()).forEach((r) => {
      if (r.type === "inbound-rtp" && r.kind === "video")
        Object.assign(out, {
          frames: r.framesDecoded, dropped: r.framesDropped, freezes: r.freezeCount, freezeS: r.totalFreezesDuration, jitter: r.jitter,
          jbDelay: r.jitterBufferDelay, jbCount: r.jitterBufferEmittedCount, w: r.frameWidth, h: r.frameHeight,
          decoder: r.decoderImplementation, lost: r.packetsLost, nack: r.nackCount, pli: r.pliCount, codecId: r.codecId,
          ifd: r.totalInterFrameDelay, ifd2: r.totalSquaredInterFrameDelay,
        });
      if (r.type === "inbound-rtp" && r.kind === "audio") out.audioEnergy = r.totalAudioEnergy;
      if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") out.rttMs = Math.round((r.currentRoundTripTime || 0) * 1000);
    });
    return out;
  });
  if (last) samples.push({ fps: st.frames - last.frames, ...st });
  last = st;
  if (s % 30 === 29) console.log(`[tv] ${s + 1}s fps ${st.frames - (samples.at(-2)?.frames ?? st.frames)} freezes ${st.freezes} jb ${st.jbCount ? Math.round((st.jbDelay / st.jbCount) * 1000) : "?"} ms`);
}
const codec = await page.evaluate(async () => {
  let id = null;
  let name = null;
  const stats = await window.receiverPc.getStats();
  stats.forEach((r) => {
    if (r.type === "inbound-rtp" && r.kind === "video") id = r.codecId;
  });
  stats.forEach((r) => {
    if (r.id === id) name = r.mimeType;
  });
  return name;
});
const lat = await page.evaluate(() => window.__lat);
const intervals = await page.evaluate(() => window.__intervals);
const callbacksMissed = await page.evaluate(() => window.__presentedJumps || 0);
const measuredOn = await page.evaluate(() => window.__measuredOn);
const presenterSkipped = await page.evaluate(() => window.__present?.skipped ?? null);
const rtpIntervals = await page.evaluate(() => window.__rtpIntervals);
const recvIntervals = await page.evaluate(() => window.__recvIntervals);
const audioTracks = await page.evaluate(() => window.__audioTracks);
const recorded = await page.evaluate(async () => {
  if (!window.__rec) return null;
  window.__rec.stop();
  await new Promise((r) => setTimeout(r, 800));
  const blob = new Blob(window.__chunks, { type: window.__rec.mimeType });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { b64: btoa(s), at: window.__recAt };
});
if (recorded) writeFileSync(`${OUT}/${RECORD ? "tv-stream.webm" : "tv-audio.webm"}`, Buffer.from(recorded.b64, "base64"));
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10 : null;
};
const fpsList = samples.map((s) => s.fps);
const lastS = samples.at(-1) ?? {};
const summary = {
  firstFrameMs,
  seconds: SECONDS,
  receivedFps: { p50: pct(fpsList, 0.5), p5: pct(fpsList, 0.05), min: Math.min(...fpsList) },
  frameIntervalMs: { n: intervals.length, p50: pct(intervals, 0.5), p95: pct(intervals, 0.95), p99: pct(intervals, 0.99), max: pct(intervals, 1) },
  sentIntervalMs: { p50: pct(rtpIntervals, 0.5), p95: pct(rtpIntervals, 0.95), max: pct(rtpIntervals, 1) },
  receivedIntervalMs: { p50: pct(recvIntervals, 0.5), p95: pct(recvIntervals, 0.95), max: pct(recvIntervals, 1) },
  // Inter-frame delay at the decoder (W3C stats): mean and standard deviation over the run.
  decodeInterFrameMs: (() => {
    const f = samples[0];
    const l = lastS;
    if (!f || l.ifd == null) return null;
    const n = l.frames - f.frames;
    const m = (l.ifd - f.ifd) / n;
    const sd = Math.sqrt(Math.max(0, (l.ifd2 - f.ifd2) / n - m * m));
    return { mean: Math.round(m * 10000) / 10, sd: Math.round(sd * 10000) / 10 };
  })(),
  measuredOn,
  presenterSkipped,
  callbacksMissed,
  freezes: lastS.freezes,
  freezeSeconds: lastS.freezeS,
  size: `${lastS.w}x${lastS.h}`,
  codec,
  decoder: lastS.decoder,
  jitterMs: Math.round((lastS.jitter ?? 0) * 1000),
  jitterBufferMs: lastS.jbCount ? Math.round((lastS.jbDelay / lastS.jbCount) * 1000) : null,
  dropped: lastS.dropped,
  lost: lastS.lost,
  nack: lastS.nack,
  pli: lastS.pli,
  rttMs: lastS.rttMs,
  audioTracks,
  audioEnergy: lastS.audioEnergy,
  glassToGlassMs: lat.length ? { n: lat.length, p50: pct(lat, 0.5), p90: pct(lat, 0.9), p99: pct(lat, 0.99), min: Math.min(...lat) } : null,
  recordedAt: recorded?.at ?? null,
  phone: phoneLogs,
  receiverPeerStats: rxEvents.filter((e) => e.name === "receiver.peer.stats").map((e) => e.data),
};
writeFileSync(`${OUT}/tv-summary.json`, JSON.stringify(summary, null, 2));
writeFileSync(`${OUT}/intervals.json`, JSON.stringify({ presented: intervals, rtp: rtpIntervals, received: recvIntervals }));
const { phone, receiverPeerStats, ...brief } = summary;
console.log(JSON.stringify(brief, null, 2));
await ctx.close();
await browser.close();
ws.close();
