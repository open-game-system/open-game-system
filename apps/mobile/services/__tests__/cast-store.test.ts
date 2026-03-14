import {
  createCastStore,
  CAST_INITIAL_STATE,
  type NativeCastState,
  type NativeCastEvents,
} from "../cast-store";

// Mock react-native-google-cast
jest.mock("react-native-google-cast", () => ({
  __esModule: true,
  default: {
    showCastDialog: jest.fn(),
    showIntroductoryOverlay: jest.fn().mockResolvedValue(undefined),
    sessionManager: {
      onSessionStarted: jest.fn(() => ({ remove: jest.fn() })),
      onSessionEnded: jest.fn(() => ({ remove: jest.fn() })),
      onSessionResumed: jest.fn(() => ({ remove: jest.fn() })),
    },
  },
  CastState: {
    NO_DEVICES_AVAILABLE: 0,
    NOT_CONNECTED: 1,
    CONNECTING: 2,
    CONNECTED: 3,
  },
}));

import GoogleCast from "react-native-google-cast";

describe("cast-store", () => {
  describe("CAST_INITIAL_STATE", () => {
    it("has isAvailable false", () => {
      expect(CAST_INITIAL_STATE.isAvailable).toBe(false);
    });

    it("has empty devices array", () => {
      expect(CAST_INITIAL_STATE.devices).toEqual([]);
    });

    it("has session status disconnected", () => {
      expect(CAST_INITIAL_STATE.session.status).toBe("disconnected");
    });

    it("has null error", () => {
      expect(CAST_INITIAL_STATE.error).toBe(null);
    });
  });

  describe("createCastStore", () => {
    it("creates a store with initial state", () => {
      const store = createCastStore();
      const state = store.getSnapshot();
      expect(state).toEqual(CAST_INITIAL_STATE);
    });
  });

  describe("producer — device discovery", () => {
    it("updates devices and isAvailable on DEVICES_UPDATED", () => {
      const store = createCastStore();
      store.dispatch({
        type: "DEVICES_UPDATED",
        devices: [
          { id: "tv-1", name: "Living Room TV", type: "chromecast" },
        ],
      });

      const state = store.getSnapshot();
      expect(state.isAvailable).toBe(true);
      expect(state.devices).toHaveLength(1);
      expect(state.devices[0].name).toBe("Living Room TV");
    });

    it("sets isAvailable false when devices list becomes empty", () => {
      const store = createCastStore();

      // Add a device
      store.dispatch({
        type: "DEVICES_UPDATED",
        devices: [{ id: "tv-1", name: "TV", type: "chromecast" }],
      });
      expect(store.getSnapshot().isAvailable).toBe(true);

      // Remove all devices
      store.dispatch({ type: "DEVICES_UPDATED", devices: [] });
      expect(store.getSnapshot().isAvailable).toBe(false);
      expect(store.getSnapshot().devices).toHaveLength(0);
    });

    it("handles multiple devices", () => {
      const store = createCastStore();
      store.dispatch({
        type: "DEVICES_UPDATED",
        devices: [
          { id: "tv-1", name: "Living Room TV", type: "chromecast" },
          { id: "tv-2", name: "Bedroom TV", type: "airplay" },
        ],
      });
      expect(store.getSnapshot().devices).toHaveLength(2);
    });
  });

  describe("producer — session lifecycle", () => {
    it("sets session to connecting on START_CASTING", () => {
      const store = createCastStore();
      store.dispatch({ type: "START_CASTING", deviceId: "tv-1" });

      const session = store.getSnapshot().session;
      expect(session.status).toBe("connecting");
      expect(session.deviceId).toBe("tv-1");
    });

    it("sets session to connected on SESSION_CONNECTED", () => {
      const store = createCastStore();
      store.dispatch({
        type: "SESSION_CONNECTED",
        deviceId: "tv-1",
        deviceName: "Living Room TV",
        sessionId: "session-123",
        streamSessionId: "stream-456",
      });

      const session = store.getSnapshot().session;
      expect(session.status).toBe("connected");
      expect(session.deviceId).toBe("tv-1");
      expect(session.deviceName).toBe("Living Room TV");
      expect(session.sessionId).toBe("session-123");
      expect(session.streamSessionId).toBe("stream-456");
    });

    it("resets session to disconnected on STOP_CASTING", () => {
      const store = createCastStore();

      // Connect first
      store.dispatch({
        type: "SESSION_CONNECTED",
        deviceId: "tv-1",
        deviceName: "TV",
        sessionId: "s-1",
        streamSessionId: "str-1",
      });
      expect(store.getSnapshot().session.status).toBe("connected");

      // Stop
      store.dispatch({ type: "STOP_CASTING" });

      const session = store.getSnapshot().session;
      expect(session.status).toBe("disconnected");
      expect(session.deviceId).toBe(null);
      expect(session.deviceName).toBe(null);
      expect(session.sessionId).toBe(null);
      expect(session.streamSessionId).toBe(null);
    });

    it("resets previous session when START_CASTING while already connected", () => {
      const store = createCastStore();

      // Setup: connect to device A
      store.dispatch({
        type: "SESSION_CONNECTED",
        deviceId: "tv-1",
        deviceName: "TV 1",
        sessionId: "s-1",
        streamSessionId: "str-1",
      });
      expect(store.getSnapshot().session.status).toBe("connected");

      // Act: start casting to device B while still connected to A
      store.dispatch({ type: "START_CASTING", deviceId: "tv-2" });

      // Assert: old session fields are cleared, new device set
      const session = store.getSnapshot().session;
      expect(session.status).toBe("connecting");
      expect(session.deviceId).toBe("tv-2");
      expect(session.deviceName).toBe(null);
      expect(session.sessionId).toBe(null);
      expect(session.streamSessionId).toBe(null);
    });

    it("clears error on STOP_CASTING", () => {
      const store = createCastStore();
      store.dispatch({ type: "SET_ERROR", error: "Something went wrong" });
      expect(store.getSnapshot().error).toBe("Something went wrong");

      store.dispatch({ type: "STOP_CASTING" });
      expect(store.getSnapshot().error).toBe(null);
    });
  });

  describe("producer — error handling", () => {
    it("sets error on SET_ERROR", () => {
      const store = createCastStore();
      store.dispatch({ type: "SET_ERROR", error: "Stream ended unexpectedly" });

      expect(store.getSnapshot().error).toBe("Stream ended unexpectedly");
    });

    it("clears error on RESET_ERROR", () => {
      const store = createCastStore();
      store.dispatch({ type: "SET_ERROR", error: "Some error" });
      store.dispatch({ type: "RESET_ERROR" });

      expect(store.getSnapshot().error).toBe(null);
    });
  });

  describe("producer — SHOW_CAST_PICKER side effect", () => {
    it("does not change state on SHOW_CAST_PICKER", () => {
      const store = createCastStore();
      const stateBefore = store.getSnapshot();
      store.dispatch({ type: "SHOW_CAST_PICKER" });
      const stateAfter = store.getSnapshot();
      expect(stateAfter).toEqual(stateBefore);
    });

    it("triggers GoogleCast.showCastDialog via on config", () => {
      const store = createCastStore();
      store.dispatch({ type: "SHOW_CAST_PICKER" });

      expect(GoogleCast.showCastDialog).toHaveBeenCalled();
    });
  });

  describe("producer — SCAN_DEVICES", () => {
    it("does not change state (scan is a native-side action)", () => {
      const store = createCastStore();
      const stateBefore = store.getSnapshot();
      store.dispatch({ type: "SCAN_DEVICES" });
      expect(store.getSnapshot()).toEqual(stateBefore);
    });
  });

  describe("producer — SEND_STATE_UPDATE", () => {
    it("does not change store state (forwarded to API)", () => {
      const store = createCastStore();
      const stateBefore = store.getSnapshot();
      store.dispatch({ type: "SEND_STATE_UPDATE", payload: { round: 3 } });
      expect(store.getSnapshot()).toEqual(stateBefore);
    });
  });

  describe("state subscriptions", () => {
    it("notifies subscribers on state change", () => {
      const store = createCastStore();
      const listener = jest.fn();
      store.subscribe(listener);

      store.dispatch({
        type: "DEVICES_UPDATED",
        devices: [{ id: "tv-1", name: "TV", type: "chromecast" }],
      });

      expect(listener).toHaveBeenCalled();
      const latestState = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(latestState.isAvailable).toBe(true);
    });
  });
});
