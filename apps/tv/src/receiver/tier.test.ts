import { describe, expect, it } from "vitest";
import { chooseTier, deviceClassOf, type TierSignals } from "./tier";

/** Real user agents (CrKey/1.56 era); the device class is read from DeviceType and the platform. */
const UA = {
  googleTv:
    "Mozilla/5.0 (Linux; Android 12.0; Build/STTL.240206.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000 DeviceType/AndroidTV",
  chromecast:
    "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000 DeviceType/Chromecast",
  chromecastOld:
    "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36 CrKey/1.54.248666",
  nestHub:
    "Mozilla/5.0 (Fuchsia) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000 DeviceType/SmartDisplay",
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
};

const STRONG: TierSignals = {
  userAgent: UA.desktop,
  webgl: { renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro)", maxTextureSize: 16384 },
  frame: { p50Ms: 16.7, p90Ms: 17.1, frames: 90 },
  deviceMemoryGb: 8,
};

describe("device class from the user agent", () => {
  it.each([
    [UA.googleTv, "google-tv"],
    [UA.chromecast, "chromecast"],
    [UA.chromecastOld, "chromecast"],
    [UA.nestHub, "smart-display"],
    [UA.desktop, "browser"],
  ] as const)("%s → %s", (ua, cls) => {
    expect(deviceClassOf(ua)).toBe(cls);
  });
});

describe("render tier", () => {
  it("a strong browser with a fast frame probe is full", () => {
    expect(chooseTier(STRONG)).toEqual({ tier: "full", reasons: [], deviceClass: "browser" });
  });

  it("no WebGL at all is minimal", () => {
    expect(chooseTier({ ...STRONG, webgl: null })).toMatchObject({
      tier: "minimal",
      reasons: ["no-webgl"],
    });
  });

  it.each([
    "Google SwiftShader",
    "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))",
    "llvmpipe (LLVM 15.0.7, 256 bits)",
  ])("a software renderer (%s) is minimal", (renderer) => {
    const r = chooseTier({ ...STRONG, webgl: { renderer, maxTextureSize: 8192 } });
    expect(r.tier).toBe("minimal");
    expect(r.reasons).toContain("software-gl");
  });

  it("a Chromecast with Google TV is lite even when its probe looks fast", () => {
    const r = chooseTier({
      userAgent: UA.googleTv,
      webgl: { renderer: "Mali-G31", maxTextureSize: 8192 },
      frame: { p50Ms: 16.7, p90Ms: 18, frames: 90 },
      deviceMemoryGb: 2,
    });
    expect(r).toEqual({ tier: "lite", reasons: ["device:google-tv"], deviceClass: "google-tv" });
  });

  it("a Google TV device with 4 GB or more (Google TV Streamer) is not capped by its class", () => {
    expect(chooseTier({ ...STRONG, userAgent: UA.googleTv, deviceMemoryGb: 4 }).tier).toBe("full");
  });

  it("an older Chromecast (no Android) is minimal", () => {
    const r = chooseTier({
      userAgent: UA.chromecast,
      webgl: { renderer: "Vivante GC1000", maxTextureSize: 4096 },
      frame: { p50Ms: 16.7, p90Ms: 18, frames: 90 },
    });
    expect(r.tier).toBe("minimal");
    expect(r.reasons).toContain("device:chromecast");
  });

  it("a Chromecast Ultra (it can display 4K) gets lite, not minimal", () => {
    const r = chooseTier({
      userAgent: UA.chromecast,
      webgl: { renderer: "Vivante GC7000UL", maxTextureSize: 8192 },
      frame: { p50Ms: 16.7, p90Ms: 18, frames: 90 },
      cast: { uhd: true },
    });
    expect(r).toEqual({
      tier: "lite",
      reasons: ["device:chromecast-ultra"],
      deviceClass: "chromecast",
    });
  });

  it("a Nest Hub (smart display) is lite", () => {
    expect(chooseTier({ ...STRONG, userAgent: UA.nestHub }).tier).toBe("lite");
  });

  describe("frame-time probe (a fixed 720p WebGL workload)", () => {
    it.each([
      [16.7, 17, "full"],
      [20, 21, "full"],
      [20.1, 21, "lite"],
      [16.7, 34.1, "lite"],
      [33.3, 34, "lite"],
      [40, 45, "lite"],
      [40.1, 50, "minimal"],
      [66, 80, "minimal"],
    ] as const)("p50 %s ms, p90 %s ms → %s", (p50Ms, p90Ms, tier) => {
      expect(chooseTier({ ...STRONG, frame: { p50Ms, p90Ms, frames: 90 } }).tier).toBe(tier);
    });

    it("says which probe result capped it", () => {
      expect(
        chooseTier({ ...STRONG, frame: { p50Ms: 30, p90Ms: 31, frames: 90 } }).reasons,
      ).toEqual(["frame:30ms"]);
    });

    it("a probe that couldn't run (too few frames) doesn't cap the tier", () => {
      expect(chooseTier({ ...STRONG, frame: { p50Ms: 80, p90Ms: 90, frames: 4 } }).tier).toBe(
        "full",
      );
      expect(chooseTier({ ...STRONG, frame: null }).tier).toBe("full");
    });
  });

  describe("memory", () => {
    it.each([
      [0.25, "minimal"],
      [0.5, "minimal"],
      [1, "lite"],
      [2, "full"],
      [undefined, "full"],
    ] as const)("deviceMemory %s GB → %s", (deviceMemoryGb, tier) => {
      const r = chooseTier({
        ...STRONG,
        ...(deviceMemoryGb === undefined ? {} : { deviceMemoryGb }),
      });
      expect(r.tier).toBe(tier);
    });

    it("a JS heap limit under 512 MB caps at lite", () => {
      const r = chooseTier({ ...STRONG, heapLimitMb: 400 });
      expect(r).toMatchObject({ tier: "lite", reasons: ["heap:400mb"] });
      expect(chooseTier({ ...STRONG, heapLimitMb: 2048 }).tier).toBe("full");
    });
  });

  it("a GPU without 4096 px textures is lite at most", () => {
    const r = chooseTier({ ...STRONG, webgl: { renderer: "Mali-400", maxTextureSize: 2048 } });
    expect(r).toMatchObject({ tier: "lite", reasons: ["max-texture:2048"] });
  });

  it("the weakest signal wins and every cap is listed", () => {
    const r = chooseTier({
      userAgent: UA.googleTv,
      webgl: { renderer: "Mali-G31", maxTextureSize: 8192 },
      frame: { p50Ms: 50, p90Ms: 60, frames: 90 },
      deviceMemoryGb: 2,
    });
    expect(r).toEqual({
      tier: "minimal",
      reasons: ["device:google-tv", "frame:50ms"],
      deviceClass: "google-tv",
    });
  });

  it("an override (?tier= on the receiver URL, for testing) wins over every signal", () => {
    expect(chooseTier({ ...STRONG, webgl: null, override: "full" })).toEqual({
      tier: "full",
      reasons: ["override"],
      deviceClass: "browser",
    });
  });
});
