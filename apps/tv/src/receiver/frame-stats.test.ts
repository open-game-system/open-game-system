import { describe, expect, it } from "vitest";
import { createFrameMeter, frameStats } from "./frame-stats";

describe("frame stats from rAF intervals", () => {
  it("summarises a steady 60 Hz run", () => {
    expect(frameStats(Array(60).fill(16.67))).toEqual({
      frames: 60,
      fps: 60,
      p50Ms: 16.7,
      p90Ms: 16.7,
      worstMs: 16.7,
      longFrames: 0,
    });
  });

  it("counts frames over 50 ms as long (a visible hitch) and reports the worst", () => {
    const s = frameStats([...Array(8).fill(16.7), 120, 60]);
    expect(s.longFrames).toBe(2);
    expect(s.worstMs).toBe(120);
    expect(s.p50Ms).toBe(16.7);
    expect(s.p90Ms).toBe(60);
  });

  it("a frame of exactly 50 ms is not long", () => {
    expect(frameStats([50, 50.1]).longFrames).toBe(1);
  });

  it("fps is frames over the time they took, not 1000 / median", () => {
    // 30 frames of 33.3 ms: one second, 30 fps.
    expect(frameStats(Array(30).fill(33.33)).fps).toBe(30);
    expect(frameStats([16.7, 16.7, 100]).fps).toBe(22.5);
  });

  it("an empty run is zeros", () => {
    expect(frameStats([])).toEqual({
      frames: 0,
      fps: 0,
      p50Ms: 0,
      p90Ms: 0,
      worstMs: 0,
      longFrames: 0,
    });
  });
});

describe("frame meter", () => {
  it("turns rAF timestamps into intervals and drains them per summary", () => {
    const m = createFrameMeter();
    for (const t of [1000, 1016.7, 1033.4, 1050.1]) m.tick(t);
    expect(m.drain()).toMatchObject({ frames: 3, p50Ms: 16.7 });
    expect(m.drain().frames).toBe(0);
    m.tick(1066.8);
    expect(m.drain()).toMatchObject({ frames: 1, p50Ms: 16.7 });
  });

  it("drops the gap after the page was hidden (rAF stops), so a hidden spell isn't one long frame", () => {
    const m = createFrameMeter();
    m.tick(0);
    m.tick(16.7);
    m.pause();
    m.tick(60_000);
    m.tick(60_016.7);
    expect(m.drain()).toMatchObject({ frames: 2, longFrames: 0 });
  });

  it("keeps at most the last 7200 intervals (two minutes at 60 fps)", () => {
    const m = createFrameMeter();
    for (let i = 0; i <= 10_000; i++) m.tick(i * 16);
    expect(m.drain().frames).toBe(7200);
  });
});
