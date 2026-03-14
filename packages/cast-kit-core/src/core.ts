import { createWebBridge } from '@open-game-system/app-bridge-web';
import type { CastState, CastEvents, CastStores } from './types';

export const CAST_INITIAL_STATE: CastState = {
  isAvailable: false,
  devices: [],
  session: {
    status: 'disconnected',
    deviceId: null,
    deviceName: null,
    sessionId: null,
    streamSessionId: null,
  },
  error: null,
};

type CastBridge = ReturnType<typeof createWebBridge<CastStores>>;

let bridge: CastBridge | null = null;

/** @internal Reset bridge singleton for testing */
export function _resetBridge(): void {
  bridge = null;
}

export function getCastBridge(): CastBridge | null {
  if (typeof window === 'undefined') return null;
  if (!bridge) {
    bridge = createWebBridge<CastStores>();
  }
  return bridge;
}

export function isOGSCastAvailable(): boolean {
  const b = getCastBridge();
  return b?.isSupported() ?? false;
}

export function getCastState(): CastState | null {
  const b = getCastBridge();
  const castStore = b?.getStore('cast');
  return castStore?.getSnapshot() ?? null;
}

export function onCastStateChange(callback: (state: CastState) => void): () => void {
  const b = getCastBridge();
  const castStore = b?.getStore('cast');
  if (!castStore) return () => {};

  return castStore.subscribe((state: CastState) => {
    callback(state);
  });
}

export function dispatchCastEvent(event: CastEvents): void {
  const b = getCastBridge();
  const castStore = b?.getStore('cast');
  castStore?.dispatch(event);
}
