import type { CastDevice } from "./cast-store";

type SessionDevice = { deviceId: string; friendlyName: string } | null;

/**
 * The SESSION_CONNECTED event for a new cast session, named after the device the session is
 * really on (session.getCastDevice()). The discovery list's order says nothing about which one
 * the user picked, so it's only used when there's a single candidate.
 */
export function sessionConnectedEvent(device: SessionDevice, discovered: CastDevice[]) {
  const only = discovered.length === 1 ? discovered[0] : undefined;
  const deviceId = device?.deviceId ?? only?.id ?? "unknown";
  const deviceName = device?.friendlyName ?? only?.name ?? "your TV";
  return { type: "SESSION_CONNECTED" as const, deviceId, deviceName, sessionId: "cast-session", streamSessionId: "" };
}
