import { RoomIdSchema } from "@open-game-system/ogs-protocol";
import type { FrameWindow } from "./session";

/**
 * Several couches, one room (spec §7). The app opens a joining couch's start page with
 * `ogsRoom=<room>`: join that room instead of making one. Null when the URL names none.
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
