import { createBridgeContext } from "@open-game-system/app-bridge-react";
import { getBridge, type OgsStores } from "@open-game-system/notification-kit-core";
import React, { useEffect, useMemo, useState } from "react";

// Create the context for OGS stores
const OgsContext = createBridgeContext<OgsStores>();

interface NotificationContextValue {
  isInOGSApp: boolean;
  isSupported: boolean;
  deviceId: string | null;
}

export const NotificationContext = React.createContext<NotificationContextValue>({
  isInOGSApp: false,
  isSupported: false,
  deviceId: null,
});

/**
 * Hook to access notification state and OGS app context
 */
export function useNotifications() {
  return React.useContext(NotificationContext);
}

/**
 * Provider that manages OGS bridge initialization and notification state
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const bridge = useMemo(() => getBridge(), []);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isInOGSApp, setIsInOGSApp] = useState(false);

  useEffect(() => {
    if (!bridge) return;

    setIsInOGSApp(bridge.isSupported());

    // Subscribe to the system store for device ID changes
    const systemStore = bridge.getStore("system");
    if (systemStore) {
      setDeviceId(systemStore.getSnapshot().ogsDeviceId);
      return systemStore.subscribe((state: any) => {
        setDeviceId(state.ogsDeviceId);
      });
    }

    // If store isn't available yet, wait for bridge to notify us of store changes
    return bridge.subscribe(() => {
      const store = bridge.getStore("system");
      if (store) {
        setDeviceId(store.getSnapshot().ogsDeviceId);
        store.subscribe((state: any) => {
          setDeviceId(state.ogsDeviceId);
        });
      }
    });
  }, [bridge]);

  const value = useMemo(
    () => ({
      isInOGSApp,
      isSupported: isInOGSApp && !!deviceId,
      deviceId,
    }),
    [isInOGSApp, deviceId],
  );

  return (
    <OgsContext.Provider bridge={bridge}>
      <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
    </OgsContext.Provider>
  );
}
