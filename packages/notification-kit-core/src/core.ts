import { createWebBridge } from "@open-game-system/app-bridge-web";

/**
 * Shared store definition for the OGS ecosystem.
 * This is currently localized to notification-kit but follows the pattern
 * that will be moved to app-bridge-types.
 */
export interface SystemState {
  ogsDeviceId: string | null;
}

export type SystemEvents = { type: "INITIALIZE" } | { type: "LOGOUT" };

export type OgsStores = {
  system: {
    state: SystemState;
    events: SystemEvents;
  };
};

let bridge: any = null;

// Initialize the bridge singleton
export function getBridge() {
  if (typeof window === "undefined") return null;
  if (!bridge) {
    bridge = createWebBridge<OgsStores>();
  }
  return bridge;
}

/**
 * Reset the bridge singleton. For testing only.
 * @internal
 */
export function _resetBridge() {
  bridge = null;
}

// Detects if running inside OGS WebView by checking bridge support
export function isOGSWebView(): boolean {
  const b = getBridge();
  return b?.isSupported() ?? false;
}

// Gets the ogsDeviceId from the system store snapshot
export function getDeviceId(): string | null {
  const b = getBridge();
  const systemStore = b?.getStore("system");
  return systemStore?.getSnapshot()?.ogsDeviceId ?? null;
}

// Subscribe to device ID changes via the system store
export function onDeviceIdChange(callback: (deviceId: string | null) => void): () => void {
  const b = getBridge();
  const systemStore = b?.getStore("system");
  if (!systemStore) return () => {};

  return systemStore.subscribe((state: SystemState) => {
    callback(state.ogsDeviceId);
  });
}
