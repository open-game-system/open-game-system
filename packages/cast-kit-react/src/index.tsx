import React, { useMemo, useCallback } from 'react';
import { createBridgeContext } from '@open-game-system/app-bridge-react';
import { getCastBridge, type CastStores, type CastState, type CastEvents, type CastDevice, type CastSession } from '@open-game-system/cast-kit-core';

// Create the bridge context for cast stores
const OgsCastContext = createBridgeContext<CastStores>();
const CastStoreContext = OgsCastContext.createStoreContext('cast');

/**
 * Provider that initializes the app-bridge and exposes the cast store.
 * Renders children only when the cast store is available (native app has sent STATE_INIT).
 */
export function CastProvider({ children }: { children: React.ReactNode }) {
  const bridge = useMemo(() => getCastBridge(), []);

  if (!bridge) return null;

  return (
    <OgsCastContext.Provider bridge={bridge}>
      <CastStoreContext.Provider>
        {children}
      </CastStoreContext.Provider>
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
  return useCallback(
    (event: CastEvents) => store.dispatch(event),
    [store]
  );
}

// Re-export types for convenience
export type { CastState, CastEvents, CastDevice, CastSession, CastStores };
