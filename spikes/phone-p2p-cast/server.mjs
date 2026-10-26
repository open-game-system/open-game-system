/**
 * Spike harness (docs/exec-plans/active/2026-10-25-phone-p2p-cast.md). On the Mac, on the LAN:
 *  - /sender.html      the phone's hidden WebView stand-in: a 1280×720 test scene (timestamp blocks
 *                      for glass-to-glass latency, a beep with a white flash for A/V sync) captured
 *                      with canvas.captureStream + WebAudio → MediaStreamDestination, sent over WebRTC.
 *  - /kite/...         Kite Count's TV page (wrangler dev on KITE_ORIGIN) proxied with capture.js
 *                      injected before the game's scripts: approach (a) on a real game.
 *  - /receiver.html    the real Cast receiver page (apps/web/public/receiver.html), ?signal=test.
 *  - /ws?role=phone|tv the signaling relay. It stands in for the Cast SDK's custom namespace
 *                      (urn:x-cast:org.opengame.view): PEER_OFFER / PEER_ANSWER / REQUEST_VIEW are
 *                      the same messages the receiver already speaks with a laptop.
 *  - POST /metrics     the sender's own numbers (fps, frame cost), kept for the report.
 * No TURN, no STUN, no cloud: ICE uses host (and mDNS) candidates only.
 *
 *   KITE_ORIGIN=http://127.0.0.1:8787 PORT=8797 node spikes/phone-p2p-cast/server.mjs
 */
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import WebSocket from "ws";

const WebSocketServer = WebSocket.Server;

const PORT = Number(process.env.PORT ?? 8797);
const KITE = new URL(process.env.KITE_ORIGIN ?? "http://127.0.0.1:8787");
const here = (p) => new URL(p, import.meta.url);
const RECEIVER = new URL("../../apps/web/public/receiver.html", import.meta.url);
const metrics = [];

const send = (res, type, body) => {
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/sender.html") return send(res, "text/html; charset=utf-8", readFileSync(here("./sender.html")));
  if (url.pathname === "/capture.js") return send(res, "text/javascript", readFileSync(here("./capture.js")));
  if (url.pathname === "/receiver.html") return send(res, "text/html; charset=utf-8", readFileSync(RECEIVER));
  if (url.pathname.startsWith("/keepawake.")) {
    return send(res, url.pathname.endsWith("mp4") ? "video/mp4" : "video/webm", readFileSync(new URL(`../../apps/web/public${url.pathname}`, import.meta.url)));
  }
  if (url.pathname === "/metrics" && req.method === "POST") {
    let body = "";
    for await (const c of req) body += c;
    metrics.push({ at: Date.now(), ...JSON.parse(body) });
    return send(res, "application/json", "{}");
  }
  if (url.pathname === "/metrics") return send(res, "application/json", JSON.stringify(metrics));
  if (url.pathname.startsWith("/kite/") || url.pathname === "/kite") return proxyKite(req, res, url);
  // The game's own absolute paths (/js, /css, /api, /tv) when framed under /kite.
  return proxyKite(req, res, url, false);
});

/** Kite Count through this origin; its TV page gets capture.js before any of its own scripts. */
async function proxyKite(req, res, url, strip = true) {
  const path = strip ? url.pathname.replace(/^\/kite/, "") || "/" : url.pathname;
  const target = new URL(path + url.search, KITE);
  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }
  const headers = { ...req.headers, host: KITE.host };
  delete headers["accept-encoding"];
  const up = await fetch(target, { method: req.method, headers, body, redirect: "manual" });
  const out = {};
  up.headers.forEach((v, k) => {
    if (!["content-encoding", "content-length", "transfer-encoding"].includes(k)) out[k] = v;
  });
  if (out.location) out.location = out.location.replace(KITE.origin, "");
  const type = up.headers.get("content-type") ?? "";
  if (type.includes("text/html") && /^\/tv\//.test(path)) {
    const html = (await up.text()).replace("<head>", '<head><script src="/capture.js"></script>');
    res.writeHead(up.status, out);
    return res.end(html);
  }
  res.writeHead(up.status, out);
  res.end(Buffer.from(await up.arrayBuffer()));
}

// Kite Count's room sockets (actor-kit) through this origin too.
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/ws") return;
  const up = net.connect(Number(KITE.port || 80), KITE.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) lines.push(`${k}: ${k === "host" ? KITE.host : v}`);
    up.write(`${lines.join("\r\n")}\r\n\r\n`);
    up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

// Signaling: everything a phone says goes to the TVs, and back. Logged by type.
const wss = new WebSocketServer({ server, path: "/ws" });
const peers = { phone: new Set(), tv: new Set() };
wss.on("connection", (ws, req) => {
  const role = new URL(req.url, "http://x").searchParams.get("role") === "tv" ? "tv" : "phone";
  peers[role].add(ws);
  console.log(`[signal] ${role} connected`);
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type !== "LOG" && msg.type !== "REQUEST_VIEW") console.log(`[signal] ${role} → ${msg.type} (to ${peers[role === "tv" ? "phone" : "tv"].size})`);
    for (const peer of peers[role === "tv" ? "phone" : "tv"]) peer.send(String(raw));
  });
  ws.on("close", () => {
    peers[role].delete(ws);
    console.log(`[signal] ${role} closed`);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`[spike] http://0.0.0.0:${PORT} (kite: ${KITE.origin})`));
