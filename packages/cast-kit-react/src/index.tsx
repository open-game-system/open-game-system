import { createBridgeContext } from "@open-game-system/app-bridge-react";
import {
  type CastDevice,
  type CastEvents,
  type CastSession,
  type CastState,
  type CastStores,
  getCastBridge,
} from "@open-game-system/cast-kit-core";
import type React from "react";
import { useCallback, useMemo } from "react";

// Create the bridge context for cast stores
const OgsCastContext = createBridgeContext<CastStores>();
const CastStoreContext = OgsCastContext.createStoreContext("cast");

/**
 * Provider that initializes the app-bridge and exposes the cast store.
 * Renders children only when the cast store is available (native app has sent STATE_INIT).
 */
export function CastProvider({ children }: { children: React.ReactNode }) {
  const bridge = useMemo(() => getCastBridge(), []);

  if (!bridge) return null;

  return (
    <OgsCastContext.Provider bridge={bridge}>
      <CastStoreContext.Provider>{children}</CastStoreContext.Provider>
    </OgsCastContext.Provider>
  );
}

/**
 * Returns the full CastState.
 * Re-renders on any cast state change.
 */
export function useCastState(): CastState {
  return CastStoreContext.useSelector((s) => s);
}

/**
 * Returns only the session object from cast state.
 * Re-renders only when session properties change.
 */
export function useCastSession(): CastSession {
  return CastStoreContext.useSelector((s) => s.session);
}

/**
 * Returns the devices array from cast state.
 * Re-renders only when the device list changes.
 */
export function useCastDevices(): CastDevice[] {
  return CastStoreContext.useSelector((s) => s.devices);
}

/**
 * Returns whether casting is available (any devices detected).
 * Re-renders only when availability changes.
 */
export function useCastAvailable(): boolean {
  return CastStoreContext.useSelector((s) => s.isAvailable);
}

/**
 * Returns a stable dispatch function for sending cast events.
 * Use this to dispatch commands like START_CASTING, STOP_CASTING, etc.
 */
export function useCastDispatch(): (event: CastEvents) => void {
  const store = CastStoreContext.useStore();
  return useCallback((event: CastEvents) => store.dispatch(event), [store]);
}

// ─── Render-prop components ───

interface CastButtonState {
  status: "disconnected" | "connecting" | "connected";
  deviceCount: number;
  deviceName: string | null;
  error: string | null;
}

interface CastButtonActions {
  startCasting: (deviceId: string) => void;
  stopCasting: () => void;
  showPicker: () => void;
}

/**
 * Headless render-prop component for the cast button.
 * Renders nothing when no devices are available.
 * When devices are available, calls the render function with state and actions.
 */
export function CastButton({
  children,
}: {
  children: (state: CastButtonState, actions: CastButtonActions) => React.ReactElement | null;
}) {
  const isAvailable = useCastAvailable();
  const session = useCastSession();
  const devices = useCastDevices();
  const dispatch = useCastDispatch();
  const error = CastStoreContext.useSelector((s) => s.error);

  if (!isAvailable) return null;

  const actions: CastButtonActions = {
    startCasting: (deviceId: string) => dispatch({ type: "START_CASTING", deviceId }),
    stopCasting: () => dispatch({ type: "STOP_CASTING" }),
    showPicker: () => dispatch({ type: "SHOW_CAST_PICKER" }),
  };

  return children(
    {
      status: session.status,
      deviceCount: devices.length,
      deviceName: session.deviceName,
      error,
    },
    actions,
  );
}

interface DeviceListState {
  devices: CastDevice[];
  connectedDeviceId: string | null;
}

interface DeviceListActions {
  selectDevice: (deviceId: string) => void;
}

/**
 * Headless render-prop component for the device list.
 * Renders nothing when no devices are available.
 */
export function DeviceList({
  children,
}: {
  children: (state: DeviceListState, actions: DeviceListActions) => React.ReactElement | null;
}) {
  const devices = useCastDevices();
  const session = useCastSession();
  const dispatch = useCastDispatch();

  if (devices.length === 0) return null;

  return children(
    {
      devices,
      connectedDeviceId: session.deviceId,
    },
    {
      selectDevice: (deviceId: string) => dispatch({ type: "START_CASTING", deviceId }),
    },
  );
}

interface CastStatusState {
  status: "disconnected" | "connecting" | "connected";
  deviceName: string | null;
  error: string | null;
}

/**
 * Headless render-prop component for cast status display.
 * Renders nothing when disconnected and no error.
 */
export function CastStatus({
  children,
}: {
  children: (state: CastStatusState) => React.ReactElement | null;
}) {
  const session = useCastSession();
  const error = CastStoreContext.useSelector((s) => s.error);

  if (session.status === "disconnected" && !error) return null;

  return children({
    status: session.status,
    deviceName: session.deviceName,
    error,
  });
}

// Re-export types for convenience
export type {
  CastButtonActions,
  CastButtonState,
  CastDevice,
  CastEvents,
  CastSession,
  CastState,
  CastStatusState,
  CastStores,
  DeviceListActions,
  DeviceListState,
};
