import { RoomIdSchema } from "@open-game-system/ogs-protocol";
import type { FrameWindow } from "./session";

/**
 * The app opens the start page with `ogsRoom=<room>` for a phone joining a room it didn't make: a
 * couch phone following the TV (spec §3) or a couch joining another's (§7). Join that room instead
 * of making one. Null when the URL names none.
 */
export function ogsRoomFromUrl(url: string): string | null {
  const m = /[?&]ogsRoom=([^&#]*)/.exec(url);
  if (!m) return null;
  let room: string;
  try {
    room = decodeURIComponent(m[1] ?? "");
  } catch {
    return null;
  }
  const parsed = RoomIdSchema.safeParse(room);
  return parsed.success ? parsed.data : null;
}

/** The TV page tells the launcher which room it shows (ogs:room); nowhere when not framed. */
export function postOgsRoom(room: string, win: FrameWindow): "launcher" | "none" {
  const valid = RoomIdSchema.parse(room);
  if (!win.parent || win.parent === win) return "none";
  win.parent.postMessage({ type: "ogs:room", room: valid }, "*");
  return "launcher";
}
