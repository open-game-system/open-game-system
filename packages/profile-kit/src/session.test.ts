import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionSource, type FrameWindow } from "./session";

const jonathan = {
  id: "p_jonathan",
  handle: "jonathan.m",
  name: "Jonathan",
  avatar: "https://tv.opengame.org/art/story-nook/char-bear.webp",
};
const start = {
  type: "ogs:start",
  instanceId: "i-1",
  mode: "new",
  roster: [],
  token: "h.p.s",
  players: [jonathan],
};

/** A game's TV page framed by the launcher: `parent` records what the page posts to it. */
function framed() {
  const handlers = new Set<(ev: { data: unknown; source: unknown }) => void>();
  const posted: unknown[] = [];
  const parent = { postMessage: (msg: unknown, _origin: string) => posted.push(msg) };
  const win: FrameWindow = {
    parent,
    postMessage: () => {},
    addEventListener: (_t, h) => handlers.add(h),
    removeEventListener: (_t, h) => handlers.delete(h),
  };
  const fromParent = (data: unknown) => {
    for (const h of handlers) h({ data, source: parent });
  };
  const fromElsewhere = (data: unknown) => {
    for (const h of handlers) h({ data, source: {} });
  };
  return { win, posted, fromParent, fromElsewhere, handlers };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the couch session on a game's TV page", () => {
  it("a page that isn't framed is not on an OGS TV (null)", () => {
    const win: FrameWindow = {
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      parent: null,
    };
    win.parent = win;
    expect(createSessionSource({ win }).getSnapshot()).toBeNull();
  });

  it("says ogs:ready to the launcher when it starts listening", () => {
    const f = framed();
    createSessionSource({ win: f.win });
    expect(f.posted).toEqual([{ type: "ogs:ready" }]);
  });

  it("is undefined until ogs:start, then the players and the game token", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    const listener = vi.fn();
    source.subscribe(listener);
    expect(source.getSnapshot()).toBeUndefined();
    f.fromParent(start);
    expect(source.getSnapshot()).toEqual({
      players: [jonathan],
      token: "h.p.s",
      instanceId: "i-1",
      mode: "new",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("an ogs:start without players (an older launcher) has nobody", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    const { players: _p, ...older } = start;
    f.fromParent(older);
    expect(source.getSnapshot()?.players).toEqual([]);
  });

  it("is null after 300 ms without a start (framed by something else)", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    vi.advanceTimersByTime(299);
    expect(source.getSnapshot()).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(source.getSnapshot()).toBeNull();
  });

  it("a late start still counts (the launcher fetched the token first)", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win, timeoutMs: 10 });
    vi.advanceTimersByTime(10);
    expect(source.getSnapshot()).toBeNull();
    f.fromParent(start);
    expect(source.getSnapshot()?.token).toBe("h.p.s");
  });

  it("ignores messages that aren't from the parent, or aren't a valid start", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    f.fromElsewhere(start);
    f.fromParent({ ...start, token: 7 });
    f.fromParent({ type: "ogs:suspend" });
    f.fromParent("not json");
    expect(source.getSnapshot()).toBeUndefined();
  });

  it("a new start replaces the old one (a refreshed token)", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    f.fromParent(start);
    f.fromParent({ ...start, token: "h.p2.s2" });
    expect(source.getSnapshot()?.token).toBe("h.p2.s2");
  });

  it("stops notifying after unsubscribe", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    const listener = vi.fn();
    source.subscribe(listener)();
    f.fromParent(start);
    expect(listener).not.toHaveBeenCalled();
  });
});
