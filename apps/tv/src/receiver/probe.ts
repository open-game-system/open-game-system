import type { RenderTier } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { frameStats } from "./frame-stats";
import type { Detected } from "./receiver";
import { chooseTier, type TierSignals } from "./tier";

const Num = z.number().positive();

/**
 * The probe's workload: a 1280×720 full-screen shader with a loop roughly as heavy per pixel as a
 * lit 3D scene plus one post pass. Each frame ends with a 1-pixel readPixels, so the rAF interval
 * includes the GPU's time for the frame, not just the CPU's. Estimates, not device measurements:
 * a Mali-G31 MP2 (Chromecast with Google TV) should hold 60 Hz, a 2015–2018 Chromecast GPU should
 * not (calibrate from the receiver.tier events of real devices).
 */
const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `precision mediump float;uniform float t;uniform vec2 r;
void main(){vec2 uv=gl_FragCoord.xy/r;vec3 c=vec3(0.);
for(int i=0;i<24;i++){float f=float(i);c+=0.04*vec3(sin(uv.x*9.+t+f),cos(uv.y*7.-t*.7+f),sin((uv.x+uv.y)*5.+f*.3));uv=fract(uv*1.07+.013);}
gl_FragColor=vec4(c,1.);}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
}

function glInfo(gl: WebGLRenderingContext) {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(
    gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "unknown",
  );
  const max = Num.safeParse(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  return { renderer, maxTextureSize: max.success ? max.data : 0 };
}

/** Draws the workload for up to `frames` frames or `maxMs`, after 10 warm-up frames. */
async function frameProbe(
  gl: WebGLRenderingContext,
  frames: number,
  maxMs: number,
): Promise<TierSignals["frame"]> {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, 1280, 720);
  gl.uniform2f(gl.getUniformLocation(prog, "r"), 1280, 720);
  const tLoc = gl.getUniformLocation(prog, "t");
  const px = new Uint8Array(4);
  const intervals: number[] = [];
  let last = 0;
  let n = 0;
  const start = performance.now();
  await new Promise<void>((done) => {
    const step = (now: number) => {
      gl.uniform1f(tLoc, now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (n > 10) intervals.push(now - last);
      last = now;
      n++;
      if (intervals.length >= frames || now - start > maxMs) done();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  const s = frameStats(intervals);
  return { p50Ms: s.p50Ms, p90Ms: s.p90Ms, frames: s.frames };
}

/** Gathers the tier signals in this browser and chooses the tier (tier.ts). */
export async function measureTv(opts: {
  uhd?: boolean;
  override?: RenderTier;
  frames?: number;
  maxMs?: number;
}): Promise<Detected> {
  const t0 = performance.now();
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const gl = canvas.getContext("webgl", { antialias: false, powerPreference: "high-performance" });
  const webgl = gl ? glInfo(gl) : null;
  let frame: TierSignals["frame"] = null;
  if (gl && !opts.override) {
    try {
      frame = await frameProbe(gl, opts.frames ?? 90, opts.maxMs ?? 1500);
    } catch {
      frame = null;
    }
  }
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  const memory = Num.safeParse(Reflect.get(navigator, "deviceMemory"));
  const heap = Num.safeParse(
    Reflect.get(Reflect.get(performance, "memory") ?? {}, "jsHeapSizeLimit"),
  );
  const signals: TierSignals = {
    userAgent: navigator.userAgent,
    webgl,
    frame,
    ...(memory.success ? { deviceMemoryGb: memory.data } : {}),
    ...(heap.success ? { heapLimitMb: Math.round(heap.data / 2 ** 20) } : {}),
    ...(opts.uhd !== undefined ? { cast: { uhd: opts.uhd } } : {}),
    ...(opts.override ? { override: opts.override } : {}),
  };
  return { choice: chooseTier(signals), signals, probeMs: performance.now() - t0 };
}
