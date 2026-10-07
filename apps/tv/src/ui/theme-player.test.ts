import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThemePlayer, type ThemeTrack } from "./theme-player";

// Spec: docs/acceptance/2026-10-04-launcher-theme.feature
class FakeTrack implements ThemeTrack {
  loop = false;
  volume = 1;
  paused = true;
  plays = 0;
  released = false;
  constructor(
    readonly src: string,
    private readonly blocked: () => boolean,
  ) {}
  play(): Promise<void> {
    this.plays++;
    if (this.blocked()) return Promise.reject(new DOMException("no gesture", "NotAllowedError"));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

let tracks: FakeTrack[];
let blocked: boolean;
const setup = () =>
  createThemePlayer({
    create: (src) => {
      const t = new FakeTrack(src, () => blocked);
      tracks.push(t);
      return t;
    },
    release: (t) => {
      const f = tracks.find((x) => x === t);
      if (f) f.released = true;
    },
  });
const live = () => tracks.filter((t) => !t.released);
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  tracks = [];
  blocked = false;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("theme player", () => {
  it("plays a theme looped, fading in from silence to 0.5 over about 600 ms", async () => {
    const p = setup();
    p.set("/a.mp3");
    await flush();
    const [a] = tracks;
    expect(a?.src).toBe("/a.mp3");
    expect(a?.loop).toBe(true);
    expect(a?.paused).toBe(false);
    expect(a?.volume).toBeLessThan(0.05);
    await vi.advanceTimersByTimeAsync(300);
    expect(a?.volume).toBeGreaterThan(0.15);
    expect(a?.volume).toBeLessThan(0.35);
    await vi.advanceTimersByTimeAsync(400);
    expect(a?.volume).toBe(0.5);
  });

  it("the same theme again keeps playing, no restart", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.plays).toBe(1);
    expect(tracks[0]?.volume).toBe(0.5);
  });

  it("crossfades to the next theme: the old fades out and is let go, the new fades in", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    p.set("/b.mp3");
    await vi.advanceTimersByTimeAsync(300);
    const [a, b] = tracks;
    expect(a?.volume).toBeGreaterThan(0.15);
    expect(a?.volume).toBeLessThan(0.35);
    expect(b?.volume).toBeGreaterThan(0.15);
    expect(b?.volume).toBeLessThan(0.35);
    await vi.advanceTimersByTimeAsync(400);
    expect(a?.paused).toBe(true);
    expect(a?.released).toBe(true);
    expect(live().map((t) => t.src)).toEqual(["/b.mp3"]);
    expect(b?.volume).toBe(0.5);
  });

  it("no theme fades the playing one out to silence", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    p.set(null);
    await vi.advanceTimersByTimeAsync(300);
    expect(tracks[0]?.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(tracks[0]?.volume).toBe(0);
    expect(tracks[0]?.paused).toBe(true);
    expect(live()).toEqual([]);
  });

  it("coming back to a theme that is still fading out picks it up again", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    p.set("/b.mp3");
    await vi.advanceTimersByTimeAsync(200);
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    expect(tracks.map((t) => t.src)).toEqual(["/a.mp3", "/b.mp3"]);
    expect(live().map((t) => t.src)).toEqual(["/a.mp3"]);
    expect(tracks[0]?.volume).toBe(0.5);
    expect(tracks[0]?.plays).toBe(1);
  });

  it("knows a theme by the URL it was asked for, though an element reads its src back absolute", async () => {
    const p = createThemePlayer({
      create: (src) => {
        const t = new FakeTrack(`http://tv.local${src}`, () => blocked);
        tracks.push(t);
        return t;
      },
    });
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    p.set("/a.mp3");
    p.set("/b.mp3");
    await vi.advanceTimersByTimeAsync(100);
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    expect(tracks.map((t) => t.src)).toEqual(["http://tv.local/a.mp3", "http://tv.local/b.mp3"]);
    expect(tracks[0]?.volume).toBe(0.5);
  });

  it("silence from the start creates nothing", async () => {
    const p = setup();
    p.set(null);
    await vi.advanceTimersByTimeAsync(700);
    expect(tracks).toEqual([]);
  });

  it("a blocked autoplay doesn't throw; the next retry (a key press) starts it", async () => {
    blocked = true;
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    expect(tracks[0]?.paused).toBe(true);
    blocked = false;
    p.retry();
    await flush();
    expect(tracks[0]?.plays).toBe(2);
    expect(tracks[0]?.paused).toBe(false);
    expect(tracks[0]?.volume).toBeLessThan(0.05);
    await vi.advanceTimersByTimeAsync(700);
    expect(tracks[0]?.volume).toBe(0.5);
  });

  it("retry does nothing while the theme is playing", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    p.retry();
    await flush();
    expect(tracks[0]?.plays).toBe(1);
    expect(tracks[0]?.volume).toBe(0.5);
  });

  it("dispose stops and lets go of everything", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(100);
    p.dispose();
    expect(tracks[0]?.paused).toBe(true);
    expect(live()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops ticking once every fade has finished", async () => {
    const p = setup();
    p.set("/a.mp3");
    await vi.advanceTimersByTimeAsync(700);
    expect(vi.getTimerCount()).toBe(0);
    p.set(null);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(700);
    expect(vi.getTimerCount()).toBe(0);
  });
});
