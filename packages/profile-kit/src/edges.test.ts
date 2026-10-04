import { createMockBridge } from "@open-game-system/app-bridge-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileSource, type ProfileBridge } from "./profile";
import { type OgsBridge, reportOgsInstance } from "./report";
import { createSessionSource, type FrameWindow } from "./session";
import { readGameToken } from "./token";

const juneau = {
  id: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: "https://tv.opengame.org/art/story-nook/char-dragon.webp",
  token: "h.p.s",
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** An app bridge that counts who is listening to it and to its profile store. */
function countingBridge() {
  const bridgeListeners = new Set<() => void>();
  const storeListeners = new Set<(s: unknown) => void>();
  let storeSubscriptions = 0;
  let state: unknown = { status: "ready", profile: juneau };
  let hasStore = false;
  const store = {
    getSnapshot: () => state,
    subscribe: (l: (s: unknown) => void) => {
      storeListeners.add(l);
      storeSubscriptions++;
      return () => storeListeners.delete(l);
    },
  };
  const bridge: ProfileBridge = {
    isSupported: () => true,
    getStore: () => (hasStore ? store : undefined),
    subscribe: (l) => {
      bridgeListeners.add(l);
      return () => bridgeListeners.delete(l);
    },
  };
  return {
    bridge,
    bridgeListeners,
    storeListeners,
    storeSubscriptions: () => storeSubscriptions,
    arrive() {
      hasStore = true;
      for (const l of bridgeListeners) l();
    },
    pokeBridge() {
      for (const l of bridgeListeners) l();
    },
    set(next: unknown) {
      state = next;
      for (const l of storeListeners) l(next);
    },
  };
}

describe("profile source bookkeeping", () => {
  it("tells listeners only when the profile really changed", () => {
    const b = countingBridge();
    b.arrive();
    const source = createProfileSource({ bridge: b.bridge });
    const listener = vi.fn();
    source.subscribe(listener);
    vi.advanceTimersByTime(1000);
    b.pokeBridge();
    expect(listener).not.toHaveBeenCalled();
  });

  it("follows the profile store once, however often the bridge changes", () => {
    const b = countingBridge();
    const source = createProfileSource({ bridge: b.bridge });
    source.subscribe(() => {});
    b.arrive();
    b.pokeBridge();
    b.pokeBridge();
    expect(b.storeSubscriptions()).toBe(1);
  });

  it("attaches once for many listeners, and lets go of everything when the last one leaves", () => {
    const b = countingBridge();
    b.arrive();
    const source = createProfileSource({ bridge: b.bridge });
    const offA = source.subscribe(() => {});
    const offB = source.subscribe(() => {});
    expect(b.bridgeListeners.size).toBe(1);
    offA();
    expect(b.bridgeListeners.size).toBe(1);
    offB();
    expect(b.bridgeListeners.size).toBe(0);
    expect(b.storeListeners.size).toBe(0);
    expect(() => offB()).not.toThrow();
  });

  it("a listener that leaves and comes back hears the next change", () => {
    const b = countingBridge();
    b.arrive();
    const source = createProfileSource({ bridge: b.bridge });
    source.subscribe(() => {})();
    const listener = vi.fn();
    source.subscribe(listener);
    b.set({ status: "ready", profile: { ...juneau, name: "June" } });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("the couch session's messages", () => {
  function framed() {
    const posts: [unknown, string][] = [];
    const types: string[] = [];
    let handler: ((ev: { data: unknown; source: unknown }) => void) | null = null;
    const parent = { postMessage: (m: unknown, origin: string) => posts.push([m, origin]) };
    const win: FrameWindow = {
      parent,
      postMessage: () => {},
      addEventListener: (type, h) => {
        types.push(type);
        handler = h;
      },
      removeEventListener: () => {},
    };
    return {
      win,
      posts,
      types,
      fromParent: (data: unknown) => handler?.({ data, source: parent }),
    };
  }

  it("listens for message events and says ogs:ready to any origin", () => {
    const f = framed();
    createSessionSource({ win: f.win });
    expect(f.types).toEqual(["message"]);
    expect(f.posts).toEqual([[{ type: "ogs:ready" }, "*"]]);
  });

  it("a start before the timeout is kept when the timeout passes", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    f.fromParent({
      type: "ogs:start",
      instanceId: "i-1",
      mode: "new",
      roster: [],
      token: "h.p.s",
      players: [],
    });
    vi.advanceTimersByTime(1000);
    expect(source.getSnapshot()?.token).toBe("h.p.s");
  });

  it("a page that isn't framed hands back an unsubscribe", () => {
    const win: FrameWindow = {
      parent: null,
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const off = createSessionSource({ win }).subscribe(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });
});

describe("reporting edges", () => {
  const report = {
    instanceId: "rocket-crew:PQWS",
    appId: "rocket-crew",
    status: "active" as const,
  };

  it("posts ogs:instance to the launcher for any origin", () => {
    const posts: [unknown, string][] = [];
    const win: FrameWindow = {
      parent: { postMessage: (m, origin) => posts.push([m, origin]) },
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    reportOgsInstance(report, { bridge: createMockBridge({ isSupported: false }), win });
    expect(posts[0]?.[1]).toBe("*");
  });

  it("keeps waiting through bridge changes until the ogs store exists", () => {
    const listeners = new Set<() => void>();
    let store: { dispatch: (e: unknown) => void } | undefined;
    const sent: unknown[] = [];
    const bridge: OgsBridge = {
      isSupported: () => true,
      getStore: () => store,
      subscribe: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
    const win: FrameWindow = {
      parent: null,
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    reportOgsInstance(report, { bridge, win });
    for (const l of [...listeners]) l();
    store = { dispatch: (e) => sent.push(e) };
    for (const l of [...listeners]) l();
    for (const l of [...listeners]) l();
    expect(sent).toHaveLength(1);
    expect(listeners.size).toBe(0);
  });
});

describe("reading a game token", () => {
  const payload = btoa(
    JSON.stringify({
      iss: "https://api.opengame.org",
      aud: "rocket-crew",
      sub: "p_juneau",
      handle: "juneau",
      name: "Juneau",
      avatar: "https://tv.opengame.org/a.webp",
      iat: 1,
      exp: 2,
    }),
  ).replace(/=+$/, "");

  it("only reads a three-part token", () => {
    expect(readGameToken(`h.${payload}.s`)?.sub).toBe("p_juneau");
    expect(readGameToken(`h.${payload}`)).toBeNull();
    expect(readGameToken(`h.${payload}.s.x`)).toBeNull();
  });
});
