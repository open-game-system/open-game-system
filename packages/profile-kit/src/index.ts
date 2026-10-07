import { createWebBridge } from "@open-game-system/app-bridge-web";
import { listenForPause } from "./pause";
import {
  createProfileSource,
  type ProfileSnapshot,
  type ProfileStores,
  type Source,
} from "./profile";
import { type InstanceReportInput, type OgsStores, reportOgsInstance } from "./report";
import { postOgsRoom } from "./room";
import { createSessionSource, type SessionSnapshot } from "./session";

export { listenForPause } from "./pause";
export * from "./profile";
export * from "./report";
export { ogsRoomFromUrl } from "./room";
export * from "./session";
export { readGameToken } from "./token";

type Bridge = ReturnType<typeof createWebBridge<ProfileStores & OgsStores>>;
let bridge: Bridge | null = null;
let profileSource: Source<ProfileSnapshot> | null = null;
let sessionSource: Source<SessionSnapshot> | null = null;

const sharedBridge = (): Bridge => {
  bridge ??= createWebBridge<ProfileStores & OgsStores>();
  return bridge;
};
const nobody: Source<null> = { getSnapshot: () => null, subscribe: () => () => {} };

/** The page's OGS profile (one per page; a plain browser or the server: always null). */
export function getOgsProfileSource(): Source<ProfileSnapshot> {
  if (typeof window === "undefined") return nobody;
  profileSource ??= createProfileSource({ bridge: sharedBridge() });
  return profileSource;
}

/** The page's couch session from the OGS launcher (one per page; not framed: null). */
export function getOgsSessionSource(): Source<SessionSnapshot> {
  if (typeof window === "undefined") return nobody;
  sessionSource ??= createSessionSource({ win: window });
  return sessionSource;
}

/**
 * Tells OGS this sitting's label (`title`: "Mission 6", "Room KQTP"): through the app bridge in
 * the OGS app, to the launcher on the TV, nowhere in a plain browser.
 */
export function reportOgsSitting(report: InstanceReportInput): "bridge" | "launcher" | "none" {
  if (typeof window === "undefined") return "none";
  return reportOgsInstance(report, { bridge: sharedBridge(), win: window });
}

/**
 * The OGS launcher parked this game (Home, or another game) or brought it back (Continue): silence
 * the game while `paused`. Returns a function that stops listening; a plain browser never pauses.
 */
export function onOgsPause(onPause: (paused: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  return listenForPause(onPause, window);
}

/**
 * The TV page of a room-based game says which room it shows (spec §3, §7): the couch's other
 * phones follow into it, and OGS keeps it on the sitting so friends can join it (multiCouch).
 * Framed by the launcher: ogs:room; elsewhere nowhere.
 */
export function reportOgsRoom(room: string): "launcher" | "none" {
  if (typeof window === "undefined") return "none";
  return postOgsRoom(room, window);
}
