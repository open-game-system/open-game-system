import GoogleCast from "react-native-google-cast";
import type { CastBackend } from "./cast-backend";
import type { CastDevice } from "./cast-store";

/** Real Google Cast behind the CastBackend interface (discovery + session manager + picker). */
export function createGoogleCastBackend(): CastBackend {
  let devices: CastDevice[] = [];
  const listeners = new Set<(d: CastDevice[]) => void>();
  const discovery = GoogleCast.getDiscoveryManager();
  const publish = (found: { deviceId: string; friendlyName: string }[]) => {
    devices = found.map((d) => ({ id: d.deviceId, name: d.friendlyName, type: "chromecast" }));
    for (const l of listeners) l(devices);
  };
  discovery.onDevicesUpdated(publish);
  return {
    sessionManager: GoogleCast.getSessionManager(),
    startDiscovery() {
      void discovery
        .startDiscovery()
        .then(() => discovery.getDevices())
        .then(publish)
        .catch(() => {});
    },
    getDevices: () => devices,
    subscribeDevices(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    showCastDialog() {
      void GoogleCast.showCastDialog();
    },
  };
}
