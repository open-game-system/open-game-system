/**
 * Records the emulated Chromecast flow from the hosted previews, phone sender beside the TV:
 * the phone casts (LOAD_VIEW, PR #55 shape), the registered receiver page frames the TV receiver,
 * which measures the tier and draws the launcher locally; then a game starts and draws at that tier.
 * The TV is Chrome made to look like a Chromecast with Google TV (user agent, 1280×720,
 * deviceMemory 2, CPU 4× slower). Tier `lite`: with the Mac's GPU (ANGLE/Metal). Tier `minimal`:
 * Chrome with no GPU (no WebGL), as an old Chromecast or software GL. The game is a stand-in TV page
 * that reads `tier` from ogs:start (the real games need a room server).
 *
 *   node apps/tv/scripts/record-receiver.mjs lite|minimal <out.webm dir>
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const [, , tier = "lite", outDir = "recordings"] = process.argv;
const WEB = "https://feat-cast-local-render.opengame-org.pages.dev/receiver";
const TV = "https://feat-cast-local-render.ogs-tv.pages.dev/receiver";
const STAGE = "https://stage.ogs.test/";
const GAME = "https://rocket-crew.jonathanrmumm.workers.dev";
const UA =
  "Mozilla/5.0 (Linux; Android 12.0; Build/STTL.240206.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000 DeviceType/AndroidTV";

/** The stand-in game TV page: draws what OGS asks at its tier (3D-like shader at 720p for lite, 2D sprites for minimal). */
const GAME_PAGE = `<!doctype html><body style="margin:0;background:#0b1630;overflow:hidden"><canvas id=c style="width:100vw;height:100vh;display:block"></canvas><script>
const c=document.getElementById('c');let started=false;
addEventListener('message',(e)=>{if(!e.data||e.data.type!=='ogs:start'||started)return;started=true;const tier=e.data.tier||'full';
parent.postMessage({type:'ogs:instance',report:{instanceId:e.data.instanceId,appId:'rocket-crew',status:'active',title:'Mission 1'}},'*');
if(tier==='minimal'){c.width=1280;c.height=720;const x=c.getContext('2d');
const draw=(t)=>{const g=x.createLinearGradient(0,0,0,720);g.addColorStop(0,'#0b1630');g.addColorStop(1,'#2b1d4a');x.fillStyle=g;x.fillRect(0,0,1280,720);
for(let i=0;i<60;i++){x.fillStyle='rgba(255,255,255,'+(0.3+0.5*Math.abs(Math.sin(t/600+i)))+')';x.fillRect((i*211)%1280,(i*97)%460,3,3);}
const y=430-Math.abs(Math.sin(t/900))*160;x.fillStyle='#e8eef7';x.beginPath();x.moveTo(640,y-90);x.lineTo(680,y+40);x.lineTo(600,y+40);x.closePath();x.fill();
x.fillStyle='#ff7a3d';x.beginPath();x.moveTo(612,y+40);x.lineTo(668,y+40);x.lineTo(640,y+80+Math.sin(t/60)*12);x.closePath();x.fill();
x.fillStyle='#3b8f5a';x.fillRect(0,600,1280,120);requestAnimationFrame(draw)};requestAnimationFrame(draw);}
else{c.width=1280;c.height=720;const g=c.getContext('webgl');
const sh=(ty,s)=>{const o=g.createShader(ty);g.shaderSource(o,s);g.compileShader(o);return o};const p=g.createProgram();
g.attachShader(p,sh(g.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
g.attachShader(p,sh(g.FRAGMENT_SHADER,'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 u=(gl_FragCoord.xy-.5*r)/r.y;float d=length(u-vec2(0.,-.1+.08*sin(t)));vec3 k=mix(vec3(.04,.08,.2),vec3(.18,.1,.3),gl_FragCoord.y/r.y);for(int i=0;i<24;i++){float f=float(i);vec2 s=fract(vec2(f*.173,f*.311)+vec2(0.,t*.02*(1.+mod(f,3.))))*2.-1.;k+=vec3(.9)*.0008/length(u-s*vec2(1.8,.5));}k+=vec3(1.,.55,.25)*.02/max(d,.01);k+=vec3(.9,.95,1.)*smoothstep(.09,.07,length((u-vec2(0.,.05+.08*sin(t)))*vec2(2.2,1.)));gl_FragColor=vec4(k,1.);}'));
g.linkProgram(p);g.useProgram(p);g.bindBuffer(g.ARRAY_BUFFER,g.createBuffer());g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
const l=g.getAttribLocation(p,'a');g.enableVertexAttribArray(l);g.vertexAttribPointer(l,2,g.FLOAT,false,0,0);g.uniform2f(g.getUniformLocation(p,'r'),1280,720);const tl=g.getUniformLocation(p,'t');
const draw=(t)=>{g.viewport(0,0,1280,720);g.uniform1f(tl,t/1000);g.drawArrays(g.TRIANGLES,0,3);requestAnimationFrame(draw)};requestAnimationFrame(draw);}});
</script></body>`;

/** The stage: a phone (the sender) beside the TV (the receiver page, as the Cast device loads it). */
const STAGE_PAGE = `<!doctype html><html><head><style>
body{margin:0;width:1920px;height:1080px;background:#16181d;font:500 20px/1.35 system-ui,sans-serif;color:#e9e6df;overflow:hidden}
.cap{position:absolute;font-weight:700;letter-spacing:.08em;font-size:18px;color:#a8a296;text-transform:uppercase}
#phone{position:absolute;left:70px;top:150px;width:360px;height:740px;border:14px solid #2c2f36;border-radius:48px;background:#0f1115;overflow:hidden;box-shadow:0 0 0 2px #3c4049}
#phone .bar{height:44px}
#phone h1{font-size:26px;margin:10px 22px 4px}
#phone .sub{margin:0 22px 18px;color:#9a958b;font-size:17px}
.btn{margin:0 22px 14px;padding:16px 18px;border-radius:16px;background:#262a32;font-size:19px}
.btn.on{background:#f2b84b;color:#1a1a1a;font-weight:700}
#log{margin:8px 22px;font-size:15px;color:#c8c3b8;white-space:pre-wrap}
#log b{color:#f2b84b}
#tvwrap{position:absolute;left:520px;top:150px;width:1280px;height:720px;border:16px solid #050505;border-radius:10px;box-shadow:0 0 0 3px #3c4049, 0 30px 80px #000}
iframe{width:1280px;height:720px;border:0;display:block;background:#000}
#tier{position:absolute;left:520px;top:925px;font-size:24px;color:#e9e6df}
</style></head><body>
<div class="cap" style="left:70px;top:100px">Phone (sender)</div>
<div class="cap" style="left:520px;top:100px">TV: Chromecast with Google TV (emulated) — renders the launcher itself</div>
<div id="phone"><div class="bar"></div><h1>Living room</h1><div class="sub">OGS app (stand-in sender)</div>
<div class="btn" id="cast">Cast to Living Room TV</div><div class="btn" id="play">Play Rocket Crew</div><div id="log"></div></div>
<div id="tvwrap"><iframe id="rx" allow="autoplay; fullscreen; screen-wake-lock"></iframe></div>
<div id="tier"></div>
<script>
const log=(s)=>{document.getElementById('log').innerHTML+=s+'\\n'};
window.toTv=(m)=>document.getElementById('rx').contentWindow.postMessage({phone:m},'*');
addEventListener('message',(e)=>{const m=e.data&&e.data.fromTv;if(!m)return;
 if(m.type==='REQUEST_VIEW')return;
 if(m.type==='STATE'&&m.tier){log('TV says: tier <b>'+m.tier+'</b> ('+(m.reasons||[]).join(', ')+')'+(m.loaded?', launcher loaded':''));document.getElementById('tier').textContent='Render tier chosen on the TV: '+m.tier+'  ·  '+(m.reasons||[]).join(', ')+'  ·  GPU: '+(m.gpu||'none (no WebGL)');}
});
</script></body></html>`;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: tier === "lite" ? ["--use-angle=metal"] : [] });
const ctx = await browser.newContext({
  userAgent: UA,
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
});
await ctx.addInitScript(() =>
  Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 2 }),
);
await ctx.route("https://www.gstatic.com/cast/**", (r) =>
  r.fulfill({ contentType: "text/javascript", body: "" }),
);
await ctx.route("https://opengame-api.jonathanrmumm.workers.dev/**", (r) =>
  r.fulfill({ status: 202, body: "{}" }),
);
await ctx.route(`${GAME}/**`, (r) => r.fulfill({ contentType: "text/html", body: GAME_PAGE }));
await ctx.route(`${STAGE}**`, (r) =>
  r.fulfill({ contentType: "text/html; charset=utf-8", body: STAGE_PAGE }),
);
// CAF on the registered receiver page: one phone, which is the stage's phone (postMessage bridge).
await ctx.addInitScript(() => {
  if (!location.host.includes("opengame-org")) return;
  const L = {};
  let custom = null;
  const toPhone = (data) => parent.postMessage({ fromTv: data }, "*");
  const c = {
    addCustomMessageListener: (_n, h) => {
      custom = h;
    },
    sendCustomMessage: (_n, _to, data) => toPhone(data),
    addEventListener: (t, h) => {
      L[t] = [...(L[t] || []), h];
    },
    getSenders: () => [{}],
    start: () =>
      setTimeout(() => (L.senderconnected || []).forEach((h) => h({ senderId: "phone" })), 100),
    stop: () => {},
    canDisplayType: () => false,
  };
  window.cast = {
    framework: {
      CastReceiverContext: { getInstance: () => c },
      CastReceiverOptions: class {},
      system: {
        EventType: {
          SENDER_CONNECTED: "senderconnected",
          SENDER_DISCONNECTED: "senderdisconnected",
        },
        MessageType: { JSON: "JSON" },
      },
    },
  };
  addEventListener("message", (e) => {
    if (e.source === parent && e.data && e.data.phone)
      custom?.({ data: e.data.phone, senderId: "phone" });
  });
});

const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto(STAGE);
await page.evaluate(
  (u) => {
    document.getElementById("rx").src = u;
  },
  `${WEB}?tvReceiver=${encodeURIComponent(TV)}`,
);
await page.waitForTimeout(2500);

const tap = async (id, line) => {
  await page.evaluate(
    ({ id, line }) => {
      document.getElementById(id).classList.add("on");
      document.getElementById("log").innerHTML += `${line}\n`;
    },
    { id, line },
  );
};
await tap("cast", "Cast → LOAD_VIEW (launcher URL, apiUrl)");
await page.evaluate(() =>
  window.toTv({
    type: "LOAD_VIEW",
    viewUrl: "https://ogs-tv.pages.dev/?fake=1",
    apiUrl: "https://opengame-api.jonathanrmumm.workers.dev",
    attemptId: "video",
    sessionId: "video",
  }),
);
const launcher = async () => page.frames().find((f) => /\/\?fake=1/.test(f.url()));
for (let i = 0; i < 80 && !(await launcher()); i++) await page.waitForTimeout(250);
await page.waitForTimeout(3000);
await page.evaluate(() => window.toTv({ type: "GET_STATE" }));
await page.waitForTimeout(3500);

await tap("play", "Play → the couch starts Rocket Crew");
const l = await launcher();
for (const m of [
  { type: "focus.set", itemId: "game:rocket-crew" },
  { type: "select", deviceId: "jonathan-phone" },
])
  await l.evaluate((msg) => window.__ogsFake.send(msg), m);
await page.waitForTimeout(2500);
await l.evaluate((msg) => window.__ogsFake.send(msg), {
  type: "select",
  deviceId: "jonathan-phone",
});
await page.waitForTimeout(1500);
await l.evaluate((msg) => window.__ogsFake.send(msg), {
  type: "game.view",
  appId: "rocket-crew",
  url: `${GAME}/tv?room=KITE`,
});
await page.waitForTimeout(2000);
const game = page.frames().find((f) => f.url().startsWith(GAME));
const got = game ? await game.evaluate(() => 1) : null;
await page.evaluate((ok) => {
  document.getElementById("log").innerHTML += ok
    ? "TV: Rocket Crew got ogs:start with the tier\n"
    : "TV: game frame missing\n";
}, got);
await page.waitForTimeout(7000);
const video = page.video();
await ctx.close();
await browser.close();
console.log(await video.path());
