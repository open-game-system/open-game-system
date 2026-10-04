import { createWebBridge } from "@open-game-system/app-bridge-web";
import {
  createProfileSource,
  type ProfileSnapshot,
  type ProfileStores,
  type Source,
} from "./profile";
import { type InstanceReportInput, type OgsStores, reportOgsInstance } from "./report";
import { createSessionSource, type SessionSnapshot } from "./session";

export * from "./profile";
export * from "./report";
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
