import { describe, expect, it } from "vitest";
import { listenForPause } from "./pause";
import type { FrameWindow } from "./session";

/** A game's TV page framed by the launcher. */
function framed() {
  const handlers = new Set<(ev: { data: unknown; source: unknown }) => void>();
  const parent = { postMessage: () => {} };
  const win: FrameWindow = {
    parent,
    postMessage: () => {},
    addEventListener: (_t, h) => handlers.add(h),
    removeEventListener: (_t, h) => handlers.delete(h),
  };
  const send = (data: unknown, source: unknown = parent) => {
    for (const h of handlers) h({ data, source });
  };
  return { win, send, handlers };
}

describe("pause and resume from the OGS launcher", () => {
  it("ogs:suspend pauses and ogs:resume resumes (Home parks the game; Continue brings it back)", () => {
    const f = framed();
    const seen: boolean[] = [];
    listenForPause((paused) => seen.push(paused), f.win);
    f.send({ type: "ogs:suspend" });
    f.send({ type: "ogs:resume" });
    expect(seen).toEqual([true, false]);
  });

  it("ignores other launcher messages and messages from anyone but the launcher", () => {
    const f = framed();
    const seen: boolean[] = [];
    listenForPause((paused) => seen.push(paused), f.win);
    f.send({ type: "ogs:start", instanceId: "i", mode: "new", roster: [], token: "" });
    f.send({ type: "ogs:suspend" }, {});
    f.send("ogs:suspend");
    expect(seen).toEqual([]);
  });

  it("stops listening when the returned function is called", () => {
    const f = framed();
    const seen: boolean[] = [];
    const stop = listenForPause((paused) => seen.push(paused), f.win);
    stop();
    f.send({ type: "ogs:suspend" });
    expect(seen).toEqual([]);
    expect(f.handlers.size).toBe(0);
  });

  it("a page that isn't framed never pauses", () => {
    const f = framed();
    f.win.parent = f.win;
    const seen: boolean[] = [];
    listenForPause((paused) => seen.push(paused), f.win);
    f.send({ type: "ogs:suspend" }, f.win);
    expect(seen).toEqual([]);
    expect(f.handlers.size).toBe(0);
  });
});
