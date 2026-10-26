/**
 * Approach (a): what the OGS shell would inject (WKUserScript, at document start) into the hidden
 * WebView that renders the TV page on the phone. It streams the page's canvas and its Web Audio to
 * the TV over WebRTC, peer to peer on the LAN:
 *  - audio: everything the page connects to an AudioContext's destination is also connected to a
 *    MediaStreamAudioDestinationNode (the tap), whose track rides in the call;
 *  - video: canvas.captureStream(30) of `window.__ogsCastCanvas`, else the page's largest canvas.
 *    DOM (text, CSS, <img>) is NOT in it: only what the game draws into that canvas;
 *  - signaling: the receiver's own laptop protocol (REQUEST_VIEW → PEER_OFFER {sdp, iceServers: []}
 *    → PEER_ANSWER), here over the spike's WebSocket relay; in the app over the Cast namespace;
 *  - no STUN/TURN: host and mDNS candidates only; non-trickle (one offer once ICE gathering is done).
 * Sender numbers (fps sent, encode time, resolution, quality limits) go to /metrics every 5 s.
 */
(() => {
  if (window.__ogsCapture) return;
  const params = new URLSearchParams(location.search);
  const FPS = Number(params.get("fps") || 30);
  const state = { taps: [], pc: null, sent: 0, startedAt: Date.now(), snapFrames: 0 };
  window.__ogsCapture = state;

  // Approach (b2): the native side snapshots this whole WebView (DOM, CSS, canvas, WebGL) and hands
  // each frame back as a JPEG; it is drawn into a canvas that is never in the page, which is what
  // the call sends. Native sets window.__ogsSnapMode before this script runs.
  if (window.__ogsSnapMode) {
    const sc = document.createElement("canvas");
    sc.width = 1280;
    sc.height = 720;
    // In the document (WebKit only captures a canvas that is), but outside the snapshot's rect.
    sc.style.cssText = "position:fixed;left:-20000px;top:0;width:1280px;height:720px;pointer-events:none";
    const attach = () => document.body && !sc.isConnected && document.body.appendChild(sc);
    attach();
    document.addEventListener("DOMContentLoaded", attach);
    const sx = sc.getContext("2d");
    state.snapCanvas = sc;
    let busy = false;
    window.__ogsFrame = (b64) => {
      if (busy) return false;
      busy = true;
      const img = new Image();
      img.onload = () => {
        sx.drawImage(img, 0, 0, 1280, 720);
        state.snapFrames++;
        busy = false;
      };
      img.onerror = () => {
        busy = false;
      };
      img.src = `data:image/jpeg;base64,${b64}`;
      return true;
    };
  }

  // Audio tap.
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = connect.call(this, dest, ...rest);
    if (typeof AudioDestinationNode !== "undefined" && dest instanceof AudioDestinationNode) {
      const ctx = dest.context;
      let tap = state.taps.find((t) => t.context === ctx);
      if (!tap) {
        tap = ctx.createMediaStreamDestination();
        state.taps.push(tap);
        const track = tap.stream.getAudioTracks()[0];
        if (state.audioSender && track) state.audioSender.replaceTrack(track);
      }
      connect.call(this, tap);
    }
    return out;
  };

  const ws = new WebSocket(window.__ogsSignalUrl || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?role=phone`);
  const metricsUrl = window.__ogsSignalUrl ? window.__ogsSignalUrl.replace(/^ws/, "http").replace(/\/ws.*$/, "/metrics") : "/metrics";
  const say = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const log = (...a) => {
    console.log("[capture]", ...a);
    say({ type: "LOG", message: a.join(" ") });
  };

  const pickCanvas = () =>
    state.snapCanvas ||
    window.__ogsCastCanvas ||
    [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0] ||
    null;

  const gathered = (pc) =>
    new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const t = setTimeout(resolve, 2000);
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(t);
          resolve();
        }
      });
    });

  let offering = false;
  async function offer() {
    if (offering || (state.pc && state.pc.connectionState === "connected")) return;
    const canvas = pickCanvas();
    if (!canvas) return log("no canvas yet");
    offering = true;
    try {
      state.pc?.close();
      const pc = new RTCPeerConnection({ iceServers: [] });
      state.pc = pc;
      const stream = canvas.captureStream(FPS);
      const [video] = stream.getVideoTracks();
      const vs = pc.addTransceiver(video, { direction: "sendonly", streams: [stream] });
      // Pace and resolution as the TV needs: 720p at FPS, a few Mbit/s on a LAN.
      // (Encodings only exist once negotiated in WebKit: set after the answer, see onAnswer.)
      state.videoSender = vs.sender;
      const tapTrack = state.taps[0]?.stream.getAudioTracks()[0];
      const as = pc.addTransceiver(tapTrack || "audio", { direction: "sendonly", streams: [stream] });
      state.audioSender = as.sender;
      pc.onconnectionstatechange = () => log("connection", pc.connectionState);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      const cands = (pc.localDescription.sdp.match(/a=candidate:[^\r\n]+/g) || []).map((c) => c.split(" ").slice(4, 8).join(" "));
      log(`offer: ${canvas.width}x${canvas.height} @${FPS} audio=${!!tapTrack} candidates: ${cands.join(" | ")}`);
      say({ type: "PEER_OFFER", sdp: pc.localDescription.sdp, iceServers: [] });
    } catch (e) {
      log("offer failed:", e && e.message);
    } finally {
      offering = false;
    }
  }

  ws.onmessage = async (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "REQUEST_VIEW") {
      if (!state.loggedAsk) log("REQUEST_VIEW heard; offering:", offering, "pc:", state.pc && state.pc.connectionState);
      state.loggedAsk = true;
      offer();
    }
    else if (m.type === "PEER_ANSWER" && state.pc) {
      await state.pc.setRemoteDescription({ type: "answer", sdp: m.sdp });
      const p = state.videoSender.getParameters();
      if (p.encodings?.[0]) {
        p.encodings[0].maxBitrate = Number(params.get("kbps") || 6000) * 1000;
        p.encodings[0].maxFramerate = FPS;
      }
      await state.videoSender.setParameters(p).then(() => log("answer set, encoder limits set"), (e) => log("answer set; setParameters", e.message));
    } else if (m.type === "PEER_ERROR") log("receiver error", m.error);
  };
  ws.onopen = () => setTimeout(offer, 500);

  // Sender metrics.
  let last = null;
  setInterval(async () => {
    const pc = state.pc;
    if (!pc) return;
    const stats = await pc.getStats();
    stats.forEach((r) => {
      if (r.type !== "outbound-rtp" || r.kind !== "video") return;
      const now = { t: r.timestamp, frames: r.framesEncoded, sent: r.framesSent, encode: r.totalEncodeTime, bytes: r.bytesSent };
      if (last) {
        const dt = (now.t - last.t) / 1000;
        const enc = now.frames - last.frames;
        const snapFps = state.snapFrames / dt;
        state.snapFrames = 0;
        fetch(metricsUrl, {
          method: "POST",
          body: JSON.stringify({
            role: "phone",
            page: location.pathname,
            fpsEncoded: Math.round((enc / dt) * 10) / 10,
            encodeMsPerFrame: enc ? Math.round(((now.encode - last.encode) / enc) * 10000) / 10 : null,
            kbps: Math.round(((now.bytes - last.bytes) * 8) / dt / 1000),
            size: `${r.frameWidth}x${r.frameHeight}`,
            limit: r.qualityLimitationReason,
            encoder: r.encoderImplementation,
            pageFps: window.__ogsPageFps ?? null,
            snapFps: window.__ogsSnapMode ? Math.round(snapFps * 10) / 10 : null,
            mode: window.__ogsSnapMode ? "b2-snapshot" : "a-canvas",
            ua: navigator.userAgent,
          }),
        }).catch(() => {});
      }
      last = now;
    });
  }, 5000);
})();
