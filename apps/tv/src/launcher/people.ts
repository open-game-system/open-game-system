import type { Member, SessionState } from "@open-game-system/ogs-protocol";

/** The member signed in on a device, by the device's profile. */
export function nameForDevice(state: SessionState, deviceId: string | null): string | null {
  const profileId = state.devices.find((d) => d.deviceId === deviceId)?.profileId;
  return state.members.find((m) => m.profileId === profileId)?.name ?? null;
}

export function phoneOf(state: SessionState, deviceId: string | null): string {
  const name = nameForDevice(state, deviceId);
  return name ? `${name}'s phone` : "the phone";
}

/** Who played a game last time (its roster), in couch order. */
export function playersOf(
  state: Pick<SessionState, "members" | "rosters">,
  appId: string,
): Member[] {
  const roster = state.rosters[appId] ?? [];
  return state.members.filter((m) => roster.some((r) => r.profileId === m.profileId));
}
