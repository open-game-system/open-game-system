import { createMockBridge } from "@open-game-system/app-bridge-testing";
import type { ProfileBridgeState } from "@open-game-system/ogs-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfileSource, type ProfileStores } from "./profile";

const juneau = {
  id: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: "https://tv.opengame.org/art/story-nook/char-dragon.webp",
  token: "h.p.s",
};

const inApp = (state?: ProfileBridgeState) =>
  createMockBridge<ProfileStores>({
    isSupported: true,
    ...(state ? { initialState: { profile: state } } : {}),
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the OGS profile in a game page", () => {
  it("a plain browser has no profile (null)", () => {
    const source = createProfileSource({ bridge: createMockBridge({ isSupported: false }) });
    expect(source.getSnapshot()).toBeNull();
  });

  it("is the profile once the app has the game token", () => {
    const source = createProfileSource({ bridge: inApp({ status: "ready", profile: juneau }) });
    expect(source.getSnapshot()).toEqual(juneau);
  });

  it("is undefined while the app fetches the token, then the profile", () => {
    const bridge = inApp({ status: "asking" });
    const source = createProfileSource({ bridge });
    const seen: unknown[] = [];
    source.subscribe(() => seen.push(source.getSnapshot()));
    expect(source.getSnapshot()).toBeUndefined();
    bridge.setState("profile", { status: "ready", profile: juneau });
    expect(source.getSnapshot()).toEqual(juneau);
    expect(seen).toEqual([juneau]);
  });

  it("is null when the app says there is no profile for this game", () => {
    const source = createProfileSource({ bridge: inApp({ status: "none" }) });
    expect(source.getSnapshot()).toBeNull();
  });

  it("asks the app for up to 300 ms, then gives up (an app without profiles)", () => {
    const source = createProfileSource({ bridge: inApp() });
    const listener = vi.fn();
    source.subscribe(listener);
    vi.advanceTimersByTime(299);
    expect(source.getSnapshot()).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(source.getSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("takes the profile store when it arrives within 300 ms", () => {
    const bridge = inApp();
    const source = createProfileSource({ bridge });
    const listener = vi.fn();
    source.subscribe(listener);
    vi.advanceTimersByTime(100);
    bridge.setState("profile", { status: "ready", profile: juneau });
    expect(source.getSnapshot()).toEqual(juneau);
    vi.advanceTimersByTime(1000);
    expect(source.getSnapshot()).toEqual(juneau);
    expect(listener).toHaveBeenCalled();
  });

  it("a store arriving late still counts", () => {
    const bridge = inApp();
    const source = createProfileSource({ bridge });
    vi.advanceTimersByTime(500);
    expect(source.getSnapshot()).toBeNull();
    bridge.setState("profile", { status: "ready", profile: juneau });
    expect(source.getSnapshot()).toEqual(juneau);
  });

  it("a fetch that never ends falls back to null after 5 s", () => {
    const source = createProfileSource({ bridge: inApp({ status: "asking" }) });
    vi.advanceTimersByTime(4999);
    expect(source.getSnapshot()).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(source.getSnapshot()).toBeNull();
  });

  it("the timeouts can be set", () => {
    const source = createProfileSource({ bridge: inApp(), timeoutMs: 50, askingTimeoutMs: 80 });
    vi.advanceTimersByTime(50);
    expect(source.getSnapshot()).toBeNull();
    const asking = createProfileSource({
      bridge: inApp({ status: "asking" }),
      timeoutMs: 50,
      askingTimeoutMs: 80,
    });
    vi.advanceTimersByTime(79);
    expect(asking.getSnapshot()).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(asking.getSnapshot()).toBeNull();
  });

  it("follows a refreshed token", () => {
    const bridge = inApp({ status: "ready", profile: juneau });
    const source = createProfileSource({ bridge });
    bridge.setState("profile", { status: "ready", profile: { ...juneau, token: "h.p2.s2" } });
    expect(source.getSnapshot()?.token).toBe("h.p2.s2");
  });

  it("keeps the same object while nothing changed (safe for useSyncExternalStore)", () => {
    const source = createProfileSource({ bridge: inApp({ status: "ready", profile: juneau }) });
    expect(source.getSnapshot()).toBe(source.getSnapshot());
  });

  it("a ready profile stays the same object, with no extra notification, when the 5 s ask timer fires", () => {
    const bridge = inApp({ status: "asking" });
    const source = createProfileSource({ bridge });
    const listener = vi.fn();
    source.subscribe(listener);
    bridge.setState("profile", { status: "ready", profile: juneau });
    const ready = source.getSnapshot();
    expect(ready).toEqual(juneau);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5001);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.getSnapshot()).toBe(ready);
  });

  it("a malformed store is no profile", () => {
    const bridge = createMockBridge<{ profile: { state: { status: string }; events: never } }>({
      isSupported: true,
      initialState: { profile: { status: "ready" } },
    });
    expect(createProfileSource({ bridge }).getSnapshot()).toBeNull();
  });

  it("stops listening when the last listener leaves", () => {
    const bridge = inApp({ status: "asking" });
    const source = createProfileSource({ bridge });
    const listener = vi.fn();
    const off = source.subscribe(listener);
    off();
    bridge.setState("profile", { status: "ready", profile: juneau });
    expect(listener).not.toHaveBeenCalled();
    expect(source.getSnapshot()).toEqual(juneau);
  });

  it("a store that appears later is followed for its updates", () => {
    const bridge = inApp();
    const source = createProfileSource({ bridge });
    const listener = vi.fn();
    source.subscribe(listener);
    bridge.setState("profile", { status: "asking" });
    bridge.setState("profile", { status: "ready", profile: juneau });
    expect(listener).toHaveBeenLastCalledWith();
    expect(source.getSnapshot()).toEqual(juneau);
  });
});
