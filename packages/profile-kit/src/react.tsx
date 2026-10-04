import { useSyncExternalStore } from "react";
import { getOgsProfileSource, getOgsSessionSource } from "./index";
import type { ProfileSnapshot, Source } from "./profile";
import type { SessionSnapshot } from "./session";

export type { OgsProfile, ProfileSnapshot } from "./profile";
export type { OgsSession, SessionSnapshot } from "./session";

const serverSnapshot = () => undefined;

/**
 * Who is playing on this device: `undefined` while asking the OGS app (≤ 300 ms), `null` in a plain
 * browser (ask for a name), or `{ id, handle, name, avatar, token }`.
 */
export function useOgsProfile(source: Source<ProfileSnapshot> = getOgsProfileSource()) {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, serverSnapshot);
}

/**
 * On a game's TV page: `undefined` while waiting for the launcher, `null` when not on an OGS TV, or
 * `{ players, token, instanceId, mode }`.
 */
export function useOgsSession(source: Source<SessionSnapshot> = getOgsSessionSource()) {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, serverSnapshot);
}
