/**
 * Receiver smoke + frame-rate run in Chrome made to look like a Chromecast with Google TV (its user
 * agent, 1280×720, deviceMemory 2, the CPU slowed by DevTools). The receiver frames the launcher's
 * fake couch with each tier forced (?tier=), the launcher frames a stand-in game TV page that draws
 * what OGS asks a game to draw at that tier (full: 1080p 3D-like shader with a post pass; lite: 720p,
 * no post pass; minimal: 2D canvas sprites), and the receiver page's rAF rate is sampled for 10 s.
 * Emulated, not a device: DevTools slows the CPU only, the Mac's GPU is untouched.
 *
 *   pnpm --filter @open-game-system/tv exec vite --port 5191 &   (then)
 *   RX_BASE=http://localhost:5191 npx tsx scripts/receiver-smoke.ts
 */
import { chromium } from "playwright";

const BASE = process.env.RX_BASE ?? "http://localhost:5191";
const UA =
  "Mozilla/5.0 (Linux; Android 12.0; Build/STTL.240206.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000 DeviceType/AndroidTV";
const GAME = "https://rocket-crew.jonathanrmumm.workers.dev";

/** A game TV page that reads its tier from ogs:start and draws accordingly. */
const GAME_PAGE = `<!doctype html><body style="margin:0;background:#000;overflow:hidden"><canvas id=c style="width:100vw;height:100vh"></canvas><script>
const c=document.getElementById('c');let draw=null;
addEventListener('message',(e)=>{if(!e.data||e.data.type!=='ogs:start'||draw)return;const tier=e.data.tier||'full';
if(tier==='minimal'){c.width=1280;c.height=720;const x=c.getContext('2d');draw=(t)=>{x.fillStyle='#234';x.fillRect(0,0,1280,720);for(let i=0;i<40;i++){x.fillStyle='hsl('+(i*9)+' 70% 60%)';x.beginPath();x.arc(640+Math.sin(t/700+i)*500,360+Math.cos(t/900+i*2)*280,30,0,7);x.fill();}};}
else{const w=tier==='full'?1920:1280,h=tier==='full'?1080:720,it=tier==='full'?64:24;c.width=w;c.height=h;const g=c.getContext('webgl');
const sh=(ty,s)=>{const o=g.createShader(ty);g.shaderSource(o,s);g.compileShader(o);return o};const p=g.createProgram();
g.attachShader(p,sh(g.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
g.attachShader(p,sh(g.FRAGMENT_SHADER,'precision mediump float;uniform float t;uniform vec2 r;void main(){vec2 u=gl_FragCoord.xy/r;vec3 k=vec3(0.);for(int i=0;i<'+it+';i++){float f=float(i);k+=.02*vec3(sin(u.x*9.+t+f),cos(u.y*7.-t+f),sin(u.x+u.y+f));u=fract(u*1.05+.01);}gl_FragColor=vec4(k,1.);}'));
g.linkProgram(p);g.useProgram(p);g.bindBuffer(g.ARRAY_BUFFER,g.createBuffer());g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
const l=g.getAttribLocation(p,'a');g.enableVertexAttribArray(l);g.vertexAttribPointer(l,2,g.FLOAT,false,0,0);g.uniform2f(g.getUniformLocation(p,'r'),w,h);const tl=g.getUniformLocation(p,'t');
draw=(t)=>{g.viewport(0,0,w,h);g.uniform1f(tl,t/1000);g.drawArrays(g.TRIANGLES,0,3);if(tier==='full'){g.drawArrays(g.TRIANGLES,0,3);}};}
const loop=(t)=>{draw(t);requestAnimationFrame(loop)};requestAnimationFrame(loop);});
</script></body>`;

async function run(throttle: number, tier: string) {
  const browser = await chromium.launch({ args: ["--use-angle=metal"] });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
  // tsx (esbuild keepNames) wraps functions in page callbacks with __name(): define it first.
  await ctx.addInitScript("globalThis.__name = (fn) => fn;");
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
  await ctx.addInitScript(() => {
    const w = window as unknown as { __out: unknown[]; __ogsSignalOut: (d: unknown) => void };
    w.__out = [];
    w.__ogsSignalOut = (d) => w.__out.push(d);
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const t0 = Date.now();
  await page.goto(`${BASE}/receiver.html?signal=test${tier === "auto" ? "" : `&tier=${tier}`}`);
  await page.waitForFunction(
    () => typeof (window as unknown as { __ogsSignalIn?: unknown }).__ogsSignalIn === "function",
  );
  await page.evaluate(() =>
    (window as unknown as { __ogsSignalIn: (d: unknown) => void }).__ogsSignalIn({
      type: "LOAD_VIEW",
      viewUrl: "https://ogs-tv.pages.dev/?fake=1",
    }),
  );
  await page.waitForFunction(() => document.getElementById("view")?.dataset.loaded === "1", null, {
    timeout: 30_000,
  });
  const loadMs = Date.now() - t0;
  const launcher = page.frame({ url: /\/\?fake=1/ });
  await launcher?.waitForFunction(() => !!(window as unknown as { __ogsFake?: unknown }).__ogsFake);
  for (const m of [
    { type: "focus.set", itemId: "game:rocket-crew" },
    { type: "select", deviceId: "jonathan-phone" },
    { type: "select", deviceId: "jonathan-phone" },
    { type: "game.view", appId: "rocket-crew", url: `${GAME}/tv?room=KITE` },
  ])
    await launcher?.evaluate(
      (msg) => (window as unknown as { __ogsFake: { send(m: unknown): void } }).__ogsFake.send(msg),
      m,
    );
  await page.waitForTimeout(3000);
  const fps = await page.evaluate(
    () =>
      new Promise<{ fps: number; p90: number }>((resolve) => {
        const d: number[] = [];
        let last = 0;
        const start = performance.now();
        const step = (t: number) => {
          if (last) d.push(t - last);
          last = t;
          if (t - start < 10_000) requestAnimationFrame(step);
          else {
            const s = [...d].sort((a, b) => a - b);
            resolve({
              fps: Math.round((d.length * 10000) / d.reduce((a, b) => a + b, 0)) / 10,
              p90: Math.round(s[Math.ceil(s.length * 0.9) - 1] * 10) / 10,
            });
          }
        };
        requestAnimationFrame(step);
      }),
  );
  await page.evaluate(() =>
    (window as unknown as { __ogsSignalIn: (d: unknown) => void }).__ogsSignalIn({
      type: "GET_STATE",
    }),
  );
  await page.waitForTimeout(200);
  const state = await page.evaluate(() =>
    ((window as unknown as { __out: { type?: string }[] }).__out ?? []).find(
      (m) => m.type === "STATE",
    ),
  );
  await browser.close();
  return { throttle, tierAsked: tier, state, loadMs, ...fps };
}

for (const throttle of [1, 4, 6])
  for (const tier of ["auto", "full", "lite", "minimal"]) {
    const r = await run(throttle, tier);
    const s = r.state as
      | { tier?: string; reasons?: string[]; probe?: { p50Ms: number; p90Ms: number } }
      | undefined;
    console.log(
      JSON.stringify({
        cpu: `${throttle}x`,
        asked: tier,
        tier: s?.tier,
        reasons: s?.reasons,
        probe: s?.probe,
        loadMs: r.loadMs,
        fps: r.fps,
        p90Ms: r.p90,
      }),
    );
  }
