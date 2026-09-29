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
import { useCallback, useEffect, useMemo } from "react";

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
 *
 * NOTE: prefer the primitive hooks below — selecting the root object
 * re-renders on every update, including unrelated patches.
 */
export function useCastState(): CastState {
  return CastStoreContext.useSelector((s) => s);
}

/**
 * Returns the current cast session status.
 * Re-renders only when status changes.
 */
export function useCastStatus(): CastSession["status"] {
  return CastStoreContext.useSelector((s) => s.session.status);
}

/**
 * Returns the connected device name (or null when disconnected).
 */
export function useCastDeviceName(): string | null {
  return CastStoreContext.useSelector((s) => s.session.deviceName);
}

/**
 * Returns the connected device id (or null when disconnected).
 */
export function useCastDeviceId(): string | null {
  return CastStoreContext.useSelector((s) => s.session.deviceId);
}

/**
 * Returns the number of available cast devices.
 * Re-renders only when the count changes.
 */
export function useCastDeviceCount(): number {
  return CastStoreContext.useSelector((s) => s.devices.length);
}

/**
 * Returns whether casting is available (any devices detected).
 * Re-renders only when availability changes.
 */
export function useCastAvailable(): boolean {
  return CastStoreContext.useSelector((s) => s.isAvailable);
}

/**
 * Returns the current error message (or null).
 */
export function useCastError(): string | null {
  return CastStoreContext.useSelector((s) => s.error);
}

/**
 * Returns a stable dispatch function for sending cast events.
 * Use this to dispatch commands like START_CASTING, STOP_CASTING, etc.
 */
export function useCastDispatch(): (event: CastEvents) => void {
  const store = CastStoreContext.useStore();
  return useCallback((event: CastEvents) => store.dispatch(event), [store]);
}

/**
 * Declares the page the TV should show when this game is cast (e.g. a spectator/TV view).
 * The host app streams it to the receiver when a cast session starts. Pass null to leave it unset.
 */
export function useCastViewUrl(url: string | null): void {
  const dispatch = useCastDispatch();
  useEffect(() => {
    if (url) dispatch({ type: "SET_VIEW_URL", url });
  }, [url, dispatch]);
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
  const status = useCastStatus();
  const deviceName = useCastDeviceName();
  const deviceCount = useCastDeviceCount();
  const error = useCastError();
  const dispatch = useCastDispatch();

  if (!isAvailable) return null;

  const actions: CastButtonActions = {
    startCasting: (deviceId: string) => dispatch({ type: "START_CASTING", deviceId }),
    stopCasting: () => dispatch({ type: "STOP_CASTING" }),
    showPicker: () => dispatch({ type: "SHOW_CAST_PICKER" }),
  };

  return children({ status, deviceCount, deviceName, error }, actions);
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
  const status = useCastStatus();
  const deviceName = useCastDeviceName();
  const error = useCastError();

  if (status === "disconnected" && !error) return null;

  return children({ status, deviceName, error });
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
};
