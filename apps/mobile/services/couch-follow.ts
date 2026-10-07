import type { FollowTarget, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { roomStartUrl } from "./rooms";

/**
 * Every couch phone follows the TV (spec §8, join-and-invite.feature): what a follow the couch
 * session sends to a phone that is not the game's host does here. The host's own follow is
 * runtime's `onFollowHost`; this is everyone else (other phones, kids' iPads).
 */

export type FollowStep =
  /** Open the game (replacing the one open here, on a swap). */
  | { kind: "open"; appId: string; url: string; replace: boolean }
  /** Close the game open here: the TV left it (Home, or another game for a phone not in it). */
  | { kind: "close"; appId: string }
  | { kind: "stay" };

type Current = SessionState["current"];

export function followStep(
  target: FollowTarget,
  ctx: {
    /** The followed game's manifest (unused for the launcher). */
    manifest: Manifest | undefined;
    /** The game open on this phone, if any. */
    openAppId: string | null;
    /** The session's current game, as of the state that came with the follow. */
    current: Current;
    /** This phone's own page of that same sitting, when it remembers one. */
    rejoinUrl?: string;
  },
): FollowStep {
  const { manifest, openAppId } = ctx;
  if (target.kind === "launcher")
    return openAppId && openAppId !== ctx.current?.appId
      ? { kind: "close", appId: openAppId }
      : { kind: "stay" };
  if (!manifest || openAppId === target.appId) return { kind: "stay" };
  // A game that makes rooms (no static TV page) would make a new, empty room from its start page:
  // wait for the follow that names the TV's room.
  if (!target.room && !manifest.tvUrl) return { kind: "stay" };
  const start = target.room ? roomStartUrl(manifest.startUrl, target.room) : manifest.startUrl;
  return {
    kind: "open",
    appId: target.appId,
    url: ctx.rejoinUrl ?? start,
    replace: openAppId !== null,
  };
}

/**
 * Whether leaving a game here parks it on the TV (sends home). A phone following someone else's
 * game steps out to the remote and leaves the TV playing; the host, or anyone when nobody hosts
 * or the game isn't the TV's, parks it as before.
 */
export function parksOnLeave(appId: string, current: Current, deviceId: string): boolean {
  if (current?.appId !== appId || current.hostDeviceId === null) return true;
  return current.hostDeviceId === deviceId;
}
