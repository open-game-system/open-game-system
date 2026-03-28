import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetBridge,
  CAST_INITIAL_STATE,
  dispatchCastEvent,
  getCastBridge,
  getCastState,
  isOGSCastAvailable,
  onCastStateChange,
} from "./core";

describe("Cast-Kit Core (Bridge-backed)", () => {
  beforeEach(() => {
    _resetBridge();
    vi.stubGlobal("ReactNativeWebView", {
      postMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("CAST_INITIAL_STATE", () => {
    it("has isAvailable set to false", () => {
      expect(CAST_INITIAL_STATE.isAvailable).toBe(false);
    });

    it("has empty devices array", () => {
      expect(CAST_INITIAL_STATE.devices).toEqual([]);
    });

    it("has session with status disconnected", () => {
      expect(CAST_INITIAL_STATE.session.status).toBe("disconnected");
    });

    it("has session with all nullable fields set to null", () => {
      expect(CAST_INITIAL_STATE.session.deviceId).toBe(null);
      expect(CAST_INITIAL_STATE.session.deviceName).toBe(null);
      expect(CAST_INITIAL_STATE.session.sessionId).toBe(null);
      expect(CAST_INITIAL_STATE.session.streamSessionId).toBe(null);
    });

    it("has error set to null", () => {
      expect(CAST_INITIAL_STATE.error).toBe(null);
    });
  });

  describe("isOGSCastAvailable", () => {
    it("returns true when ReactNativeWebView is present", () => {
      expect(isOGSCastAvailable()).toBe(true);
    });

    it("returns false when ReactNativeWebView is missing", () => {
      vi.stubGlobal("ReactNativeWebView", undefined);
      expect(isOGSCastAvailable()).toBe(false);
    });

    it("returns false when window is undefined (SSR)", () => {
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;
      _resetBridge();
      try {
        expect(isOGSCastAvailable()).toBe(false);
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe("getCastBridge", () => {
    it("returns null when window is undefined (SSR)", () => {
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;
      _resetBridge();
      try {
        expect(getCastBridge()).toBe(null);
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it("returns the same bridge instance on subsequent calls (singleton)", () => {
      const bridge1 = getCastBridge();
      const bridge2 = getCastBridge();
      expect(bridge1).toBe(bridge2);
      expect(bridge1).not.toBe(null);
    });
  });

  describe("getCastState", () => {
    it("returns null if cast store is not initialized", () => {
      expect(getCastState()).toBe(null);
    });

    it("returns cast state from bridge after STATE_INIT", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: {
              isAvailable: true,
              devices: [{ id: "tv-1", name: "TV 1", type: "chromecast" }],
              session: {
                status: "disconnected",
                deviceId: null,
                deviceName: null,
                sessionId: null,
                streamSessionId: null,
              },
              error: null,
            },
          }),
        }),
      );

      const state = getCastState();
      expect(state).not.toBe(null);
      expect(state!.isAvailable).toBe(true);
      expect(state!.devices).toHaveLength(1);
      expect(state!.devices[0].name).toBe("TV 1");
    });
  });

  describe("onCastStateChange", () => {
    it("returns a no-op unsubscribe when cast store is not available", () => {
      const callback = vi.fn();
      const unsubscribe = onCastStateChange(callback);
      expect(typeof unsubscribe).toBe("function");
      unsubscribe(); // should not throw
      expect(callback).not.toHaveBeenCalled();
    });

    it("subscribes to cast store state changes", () => {
      getCastBridge();

      // Initialize the store
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      let latestState: any = null;
      onCastStateChange((state) => {
        latestState = state;
      });

      // Trigger state update via JSON patch
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [
              { op: "replace", path: "/isAvailable", value: true },
              {
                op: "add",
                path: "/devices/0",
                value: { id: "tv-1", name: "TV 1", type: "chromecast" },
              },
            ],
          }),
        }),
      );

      expect(latestState).not.toBe(null);
      expect(latestState.isAvailable).toBe(true);
      expect(latestState.devices).toHaveLength(1);
    });

    it("unsubscribes when returned function is called", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      const callback = vi.fn();
      const unsubscribe = onCastStateChange(callback);

      // subscribe fires immediately with current state — clear that call
      callback.mockClear();

      unsubscribe();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [{ op: "replace", path: "/isAvailable", value: true }],
          }),
        }),
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("state transitions via patches", () => {
    it("tracks device appearing via STATE_UPDATE", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      expect(getCastState()!.isAvailable).toBe(false);
      expect(getCastState()!.devices).toHaveLength(0);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [
              { op: "replace", path: "/isAvailable", value: true },
              {
                op: "add",
                path: "/devices/0",
                value: { id: "tv-1", name: "Living Room TV", type: "chromecast" },
              },
            ],
          }),
        }),
      );

      expect(getCastState()!.isAvailable).toBe(true);
      expect(getCastState()!.devices).toHaveLength(1);
      expect(getCastState()!.devices[0].name).toBe("Living Room TV");
    });

    it("tracks multiple devices", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: {
              ...CAST_INITIAL_STATE,
              isAvailable: true,
              devices: [
                { id: "tv-1", name: "Living Room TV", type: "chromecast" },
                { id: "tv-2", name: "Bedroom TV", type: "airplay" },
              ],
            },
          }),
        }),
      );

      expect(getCastState()!.devices).toHaveLength(2);
    });

    it("tracks device reappearing after disappearing", () => {
      getCastBridge();

      // Start with a device
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: {
              ...CAST_INITIAL_STATE,
              isAvailable: true,
              devices: [{ id: "tv-1", name: "Living Room TV", type: "chromecast" }],
            },
          }),
        }),
      );

      expect(getCastState()!.devices).toHaveLength(1);

      // Device disappears
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [
              { op: "replace", path: "/isAvailable", value: false },
              { op: "replace", path: "/devices", value: [] },
            ],
          }),
        }),
      );

      expect(getCastState()!.isAvailable).toBe(false);
      expect(getCastState()!.devices).toHaveLength(0);

      // Device reappears
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [
              { op: "replace", path: "/isAvailable", value: true },
              {
                op: "add",
                path: "/devices/0",
                value: { id: "tv-1", name: "Living Room TV", type: "chromecast" },
              },
            ],
          }),
        }),
      );

      expect(getCastState()!.isAvailable).toBe(true);
      expect(getCastState()!.devices).toHaveLength(1);
      expect(getCastState()!.devices[0].name).toBe("Living Room TV");
    });

    it("tracks error state transition via STATE_UPDATE", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      expect(getCastState()!.error).toBe(null);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [{ op: "replace", path: "/error", value: "Failed to send state update" }],
          }),
        }),
      );

      expect(getCastState()!.error).toBe("Failed to send state update");
    });

    it("tracks device disappearing (last device makes isAvailable false)", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: {
              ...CAST_INITIAL_STATE,
              isAvailable: true,
              devices: [{ id: "tv-1", name: "Living Room TV", type: "chromecast" }],
            },
          }),
        }),
      );

      expect(getCastState()!.isAvailable).toBe(true);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [
              { op: "replace", path: "/isAvailable", value: false },
              { op: "replace", path: "/devices", value: [] },
            ],
          }),
        }),
      );

      expect(getCastState()!.isAvailable).toBe(false);
      expect(getCastState()!.devices).toHaveLength(0);
    });

    it("tracks session connecting then connected", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      // Connecting
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [{ op: "replace", path: "/session/status", value: "connecting" }],
          }),
        }),
      );

      expect(getCastState()!.session.status).toBe("connecting");

      // Connected
      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_UPDATE",
            storeKey: "cast",
            operations: [
              { op: "replace", path: "/session/status", value: "connected" },
              { op: "replace", path: "/session/deviceId", value: "tv-1" },
              { op: "replace", path: "/session/deviceName", value: "Living Room TV" },
              { op: "replace", path: "/session/sessionId", value: "session-123" },
              { op: "replace", path: "/session/streamSessionId", value: "stream-456" },
            ],
          }),
        }),
      );

      const session = getCastState()!.session;
      expect(session.status).toBe("connected");
      expect(session.deviceId).toBe("tv-1");
      expect(session.deviceName).toBe("Living Room TV");
      expect(session.sessionId).toBe("session-123");
      expect(session.streamSessionId).toBe("stream-456");
    });
  });

  describe("dispatchCastEvent", () => {
    it("dispatches event via bridge postMessage", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      dispatchCastEvent({ type: "SCAN_DEVICES" });

      const postMessage = (window as any).ReactNativeWebView.postMessage;
      expect(postMessage).toHaveBeenCalled();

      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
      const parsed = JSON.parse(lastCall);
      expect(parsed.type).toBe("EVENT");
      expect(parsed.storeKey).toBe("cast");
      expect(parsed.event.type).toBe("SCAN_DEVICES");
    });

    it("dispatches START_CASTING with deviceId", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      dispatchCastEvent({ type: "START_CASTING", deviceId: "tv-1" });

      const postMessage = (window as any).ReactNativeWebView.postMessage;
      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
      const parsed = JSON.parse(lastCall);
      expect(parsed.event.type).toBe("START_CASTING");
      expect(parsed.event.deviceId).toBe("tv-1");
    });

    it("dispatches SEND_STATE_UPDATE when session is disconnected without throwing", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      expect(getCastState()!.session.status).toBe("disconnected");

      // Should not throw - event is dispatched to the bridge regardless of session state
      expect(() => {
        dispatchCastEvent({ type: "SEND_STATE_UPDATE", payload: { round: 1 } });
      }).not.toThrow();

      const postMessage = (window as any).ReactNativeWebView.postMessage;
      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
      const parsed = JSON.parse(lastCall);
      expect(parsed.event.type).toBe("SEND_STATE_UPDATE");
      expect(parsed.event.payload).toEqual({ round: 1 });
    });

    it("dispatches RESET_ERROR event", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      dispatchCastEvent({ type: "RESET_ERROR" });

      const postMessage = (window as any).ReactNativeWebView.postMessage;
      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
      const parsed = JSON.parse(lastCall);
      expect(parsed.type).toBe("EVENT");
      expect(parsed.storeKey).toBe("cast");
      expect(parsed.event.type).toBe("RESET_ERROR");
    });

    it("dispatches STOP_CASTING when session is disconnected without throwing", () => {
      getCastBridge();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "STATE_INIT",
            storeKey: "cast",
            data: CAST_INITIAL_STATE,
          }),
        }),
      );

      expect(getCastState()!.session.status).toBe("disconnected");

      expect(() => {
        dispatchCastEvent({ type: "STOP_CASTING" });
      }).not.toThrow();

      const postMessage = (window as any).ReactNativeWebView.postMessage;
      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1][0];
      const parsed = JSON.parse(lastCall);
      expect(parsed.event.type).toBe("STOP_CASTING");
    });

    it("does nothing when bridge is not available", () => {
      vi.stubGlobal("ReactNativeWebView", undefined);
      // Should not throw
      dispatchCastEvent({ type: "SCAN_DEVICES" });
    });

    it("does nothing when window is undefined (SSR)", () => {
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;
      _resetBridge();
      try {
        // Should not throw
        dispatchCastEvent({ type: "SCAN_DEVICES" });
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  describe("SSR safety (no window)", () => {
    it("getCastState returns null when window is undefined", () => {
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;
      _resetBridge();
      try {
        expect(getCastState()).toBe(null);
      } finally {
        globalThis.window = originalWindow;
      }
    });

    it("onCastStateChange returns no-op when window is undefined", () => {
      const originalWindow = globalThis.window;
      delete (globalThis as any).window;
      _resetBridge();
      try {
        const callback = vi.fn();
        const unsubscribe = onCastStateChange(callback);
        expect(typeof unsubscribe).toBe("function");
        unsubscribe(); // should not throw
        expect(callback).not.toHaveBeenCalled();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });
});
