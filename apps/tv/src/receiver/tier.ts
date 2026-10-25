import { RENDER_TIERS, type RenderTier } from "@open-game-system/ogs-protocol";

/**
 * What the Cast receiver knows about the device it runs on, gathered once at start (probe.ts).
 * Every field is a signal; chooseTier caps the tier by each one and keeps the weakest.
 */
export interface TierSignals {
  userAgent: string;
  /** null: no WebGL context at all. */
  webgl: { renderer: string; maxTextureSize: number } | null;
  /** The frame-time probe (a fixed 720p WebGL workload, probe.ts); null when it couldn't run. */
  frame: { p50Ms: number; p90Ms: number; frames: number } | null;
  /** navigator.deviceMemory (GB, rounded down by the browser to 0.25 / 0.5 / 1 / 2 / 4 / 8). */
  deviceMemoryGb?: number;
  /** performance.memory.jsHeapSizeLimit in MB (Chrome only). */
  heapLimitMb?: number;
  /** From CAF: the device can display 4K (a Chromecast Ultra among the older Chromecasts). */
  cast?: { uhd?: boolean };
  /** ?tier= on the receiver URL: testing and the device test steps. */
  override?: RenderTier;
}

export type DeviceClass = "google-tv" | "chromecast" | "smart-display" | "browser";

export interface TierChoice {
  tier: RenderTier;
  /** Each signal that capped the tier below full (empty for a full TV), for the receiver's log. */
  reasons: string[];
  deviceClass: DeviceClass;
}

/**
 * Cast devices name themselves in the user agent: `CrKey/<version>`, and since CrKey 1.56
 * `DeviceType/AndroidTV` (Chromecast with Google TV, Google TV Streamer), `DeviceType/Chromecast`
 * (the older dongles and the Ultra) or `DeviceType/SmartDisplay` (Nest Hub). Older firmware has no
 * DeviceType: Android in the platform means Google TV.
 */
export function deviceClassOf(userAgent: string): DeviceClass {
  if (!/CrKey\//.test(userAgent)) return "browser";
  if (/DeviceType\/AndroidTV/.test(userAgent) || /Android/.test(userAgent)) return "google-tv";
  if (/DeviceType\/SmartDisplay/.test(userAgent) || /Fuchsia/.test(userAgent))
    return "smart-display";
  return "chromecast";
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software/i;

/**
 * Frame-probe thresholds, on the median rAF interval while drawing the probe's workload (a 720p
 * full-screen shader roughly as heavy as a lite 3D scene). Up to 20 ms (≈ 50 fps or better, i.e.
 * vsync at 60 Hz with headroom): full. Up to 40 ms (≈ 25 fps): lite. Slower: minimal. A p90 over
 * 34 ms (frequent missed frames) also drops full to lite.
 */
const FULL_P50_MS = 20;
const FULL_P90_MS = 34;
const LITE_P50_MS = 40;
/** Fewer probe frames than this means the probe was cut short: it says nothing. */
const MIN_PROBE_FRAMES = 20;

const rank = (t: RenderTier) => RENDER_TIERS.indexOf(t);

/** The TV's render tier: the weakest cap any signal puts on it, with each cap's reason. */
export function chooseTier(s: TierSignals): TierChoice {
  const deviceClass = deviceClassOf(s.userAgent);
  if (s.override) return { tier: s.override, reasons: ["override"], deviceClass };
  const caps: [RenderTier, string][] = [];
  const cap = (tier: RenderTier, reason: string) => caps.push([tier, reason]);

  if (!s.webgl) cap("minimal", "no-webgl");
  else {
    if (SOFTWARE_GL.test(s.webgl.renderer)) cap("minimal", "software-gl");
    if (s.webgl.maxTextureSize < 4096) cap("lite", `max-texture:${s.webgl.maxTextureSize}`);
  }

  if (deviceClass === "google-tv" && !(s.deviceMemoryGb !== undefined && s.deviceMemoryGb >= 4))
    cap("lite", "device:google-tv");
  if (deviceClass === "chromecast")
    s.cast?.uhd ? cap("lite", "device:chromecast-ultra") : cap("minimal", "device:chromecast");
  if (deviceClass === "smart-display") cap("lite", "device:smart-display");

  const f = s.frame;
  if (f && f.frames >= MIN_PROBE_FRAMES) {
    const ms = `frame:${Math.round(f.p50Ms)}ms`;
    if (f.p50Ms > LITE_P50_MS) cap("minimal", ms);
    else if (f.p50Ms > FULL_P50_MS || f.p90Ms > FULL_P90_MS) cap("lite", ms);
  }

  const mem = s.deviceMemoryGb;
  if (mem !== undefined && mem <= 0.5) cap("minimal", `memory:${mem}gb`);
  else if (mem !== undefined && mem <= 1) cap("lite", `memory:${mem}gb`);
  if (s.heapLimitMb !== undefined && s.heapLimitMb < 512)
    cap("lite", `heap:${Math.round(s.heapLimitMb)}mb`);

  const tier = caps.reduce<RenderTier>((t, [c]) => (rank(c) > rank(t) ? c : t), "full");
  return { tier, reasons: caps.map(([, r]) => r), deviceClass };
}
