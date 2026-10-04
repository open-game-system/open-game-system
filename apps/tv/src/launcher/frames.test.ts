import type { CurrentGame } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import {
  EMPTY_FRAMES,
  nextFrames,
  readFrameMessage,
  startMessage,
  toSessionMessages,
} from "./frames";

const cur = (over: Partial<CurrentGame> = {}): CurrentGame => ({
  appId: "rocket-crew",
  instanceId: "rc-1",
  mode: "new",
  roster: [],
  label: "",
  startedAt: 1,
  viewUrl: null,
  hostDeviceId: "p1",
  ...over,
});
const RC = "https://rocket-crew.example/tv?room=AB";

describe("frame slots", () => {
  it("frames nothing until the game asks for its TV view", () => {
    expect(nextFrames(EMPTY_FRAMES, cur())).toEqual({ frames: EMPTY_FRAMES, posts: [] });
  });

  it("returns the very same frames while a game waits for its TV view (no render loop)", () => {
    expect(nextFrames(EMPTY_FRAMES, cur()).frames).toBe(EMPTY_FRAMES);
    const parked = nextFrames(nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC })).frames, null).frames;
    const waiting = nextFrames(parked, cur({ appId: "bake-shop", instanceId: "bs-1" }));
    expect(nextFrames(waiting.frames, cur({ appId: "bake-shop", instanceId: "bs-1" })).frames).toBe(waiting.frames);
  });

  it("frames the view URL when it arrives", () => {
    const { frames } = nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC }));
    expect(frames.active).toEqual({ appId: "rocket-crew", instanceId: "rc-1", url: RC });
  });

  it("keeps the frame when state repeats, and reloads it when the game asks for a new URL", () => {
    const a = nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC })).frames;
    expect(nextFrames(a, cur({ viewUrl: RC })).frames).toBe(a);
    expect(nextFrames(a, cur({ viewUrl: `${RC}2` })).frames.active?.url).toBe(`${RC}2`);
  });

  it("parks and suspends the frame on Home", () => {
    const a = nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC })).frames;
    const home = nextFrames(a, null);
    expect(home.frames).toEqual({ active: null, parked: a.active });
    expect(home.posts).toEqual([{ instanceId: "rc-1", msg: { type: "ogs:suspend" } }]);
  });

  it("resumes the parked frame at once on Continue of the same sitting", () => {
    const a = nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC })).frames;
    const parked = nextFrames(a, null).frames;
    const back = nextFrames(parked, cur({ mode: "continue" }));
    expect(back.frames).toEqual({ active: a.active, parked: null });
    expect(back.posts).toEqual([{ instanceId: "rc-1", msg: { type: "ogs:resume" } }]);
  });

  it("swaps games: the old one is suspended and parked, the new one waits for its view", () => {
    const a = nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC })).frames;
    const swap = nextFrames(a, cur({ appId: "bake-shop", instanceId: "bs-1" }));
    expect(swap.frames).toEqual({ active: null, parked: a.active });
    expect(swap.posts).toEqual([{ instanceId: "rc-1", msg: { type: "ogs:suspend" } }]);
  });

  it("does not resume a parked frame for a different sitting of the same game", () => {
    const parked = nextFrames(nextFrames(EMPTY_FRAMES, cur({ viewUrl: RC })).frames, null).frames;
    const fresh = nextFrames(parked, cur({ instanceId: "rc-2" }));
    expect(fresh.frames.active).toBeNull();
    expect(fresh.posts).toEqual([]);
  });

  it("does nothing on Home with no frame", () => {
    expect(nextFrames(EMPTY_FRAMES, null)).toEqual({ frames: EMPTY_FRAMES, posts: [] });
  });
});

describe("messages from the frame", () => {
  const ev = (data: unknown, origin = "https://rocket-crew.example") => ({ data, origin });

  it("accepts messages from the framed game's origin only", () => {
    expect(readFrameMessage(ev({ type: "ogs:resume-point", label: "Mission 6" }), RC)).toEqual({
      type: "ogs:resume-point",
      label: "Mission 6",
    });
    expect(readFrameMessage(ev({ type: "ogs:ready" }, "https://evil.example"), RC)).toBeNull();
    expect(readFrameMessage(ev({ type: "ogs:ready" }), null)).toBeNull();
    expect(readFrameMessage(ev({ type: "ogs:ready" }), "not a url")).toBeNull();
  });

  it("ignores messages that aren't the protocol", () => {
    expect(readFrameMessage(ev({ type: "ogs:resume-point" }), RC)).toBeNull();
    expect(readFrameMessage(ev("hello"), RC)).toBeNull();
  });

  it("forwards a resume point to the session", () => {
    expect(
      toSessionMessages({ type: "ogs:resume-point", label: "Mission 6" }, "rocket-crew"),
    ).toEqual([{ type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" }]);
  });

  it("uses an instance report's title as the resume point", () => {
    const report = {
      instanceId: "rc-1",
      appId: "rocket-crew",
      status: "active" as const,
      title: "Mission 7",
      detail: "",
    };
    expect(toSessionMessages({ type: "ogs:instance", report }, "rocket-crew")).toEqual([
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 7" },
    ]);
    expect(
      toSessionMessages({ type: "ogs:instance", report: { ...report, title: "" } }, "rocket-crew"),
    ).toEqual([]);
    expect(toSessionMessages({ type: "ogs:ready" }, "rocket-crew")).toEqual([]);
  });

  it("builds ogs:start from the current game without leaking the launcher token", () => {
    const roster = [{ personId: "juneau", roleId: "fixer" }];
    expect(startMessage(cur({ mode: "continue", roster }))).toEqual({
      type: "ogs:start",
      instanceId: "rc-1",
      mode: "continue",
      roster,
      token: "",
    });
  });
});
