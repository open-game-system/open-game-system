/** Four letters, no look-alikes (no I, L, O, 0, 1). */
export const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const ROOM_CODE = /^[A-HJKMNP-Z]{4}$/;

export function newRoomCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  return code;
}

/** A caller's rejoin token (a UUID): it becomes the actor-kit caller id, so a refresh keeps the seat. */
export const TOKEN = /^[0-9a-f-]{36}$/;

export type Route =
  | { kind: "host" }
  | { kind: "follow"; roomCode: string }
  | { kind: "page"; page: "tv" | "join"; roomCode: string }
  | { kind: "api" }
  | { kind: "events" }
  | { kind: "health" }
  | { kind: "asset" };

/**
 * What a request is for:
 * - `/` and `/host`: a phone starts a room (the app's gameUrl is `/host`); with `?ogsRoom=CODE`
 *   (the OGS app, a couch phone following the TV) it joins that room instead;
 * - `/tv/CODE` and `/join/CODE`: the room's TV and phone pages;
 * - `/api/*`: actor-kit; `POST /events`: client logs; `/healthz`; anything else is a static file.
 */
export function route(method: string, url: URL): Route {
  const [, head = "", raw = ""] = url.pathname.split("/");
  const code = raw.toUpperCase();
  if (url.pathname === "/" || url.pathname === "/host") {
    const follow = (url.searchParams.get("ogsRoom") ?? "").toUpperCase();
    return ROOM_CODE.test(follow) ? { kind: "follow", roomCode: follow } : { kind: "host" };
  }
  if ((head === "tv" || head === "join") && ROOM_CODE.test(code)) return { kind: "page", page: head, roomCode: code };
  if (head === "api") return { kind: "api" };
  if (url.pathname === "/events" && method === "POST") return { kind: "events" };
  if (url.pathname === "/healthz") return { kind: "health" };
  return { kind: "asset" };
}
