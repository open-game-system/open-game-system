import type { SessionState } from "@open-game-system/ogs-protocol";
import type { Household } from "../session/data";

export function nameForDevice(
  state: SessionState,
  household: Household,
  deviceId: string | null,
): string | null {
  const personId = state.devices.find((d) => d.deviceId === deviceId)?.personId;
  return household.people.find((p) => p.id === personId)?.name ?? null;
}

export function phoneOf(
  state: SessionState,
  household: Household,
  deviceId: string | null,
): string {
  const name = nameForDevice(state, household, deviceId);
  return name ? `${name}'s phone` : "the phone";
}
