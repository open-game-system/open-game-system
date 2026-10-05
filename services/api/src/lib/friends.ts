import {
  type CastingFriend,
  type Friend,
  type FriendRequest,
  type FriendRoom,
  formatInviteCode,
  INVITE_TTL_MS,
  type PublicProfile,
  sortFriends,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { findManifest } from "../catalogue";
import { gameRef, presenceOf } from "./presence";
import { SESSION_TTL_MS } from "./sessions";

/** Friendships are stored once per pair, smaller id first. */
const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

/** The profile ids of my friends with when we became friends (a CTE named f: id, since). */
const FRIENDS_CTE = `WITH f AS (
  SELECT CASE WHEN profile_a = ?1 THEN profile_b ELSE profile_a END AS id, created_at AS since
  FROM friendships WHERE profile_a = ?1 OR profile_b = ?1)`;

const ProfileRowSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  sticker: z.string(),
});
const FriendRowSchema = ProfileRowSchema.extend({ since: z.number() });

export async function areFriends(db: D1Database, x: string, y: string): Promise<boolean> {
  const [a, b] = pair(x, y);
  const row = await db
    .prepare("SELECT 1 AS one FROM friendships WHERE profile_a = ? AND profile_b = ?")
    .bind(a, b)
    .first();
  return row !== null;
}

/** Makes x and y friends and clears any request between them. */
export async function befriend(db: D1Database, x: string, y: string, now: number) {
  const [a, b] = pair(x, y);
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO friendships (profile_a, profile_b, created_at) VALUES (?, ?, ?)",
      )
      .bind(a, b, now),
    db
      .prepare(
        `DELETE FROM friend_requests
         WHERE (from_profile_id = ?1 AND to_profile_id = ?2) OR (from_profile_id = ?2 AND to_profile_id = ?1)`,
      )
      .bind(x, y),
  ]);
}

/** Ends the friendship (both ways). False when they were not friends. */
export async function unfriend(db: D1Database, x: string, y: string): Promise<boolean> {
  const [a, b] = pair(x, y);
  const res = await db
    .prepare("DELETE FROM friendships WHERE profile_a = ? AND profile_b = ?")
    .bind(a, b)
    .run();
  return res.meta.changes > 0;
}

/** My friends with presence, in list order. */
export async function listFriends(db: D1Database, me: string, now: number): Promise<Friend[]> {
  const { results } = await db
    .prepare(
      `${FRIENDS_CTE} SELECT p.id, p.handle, p.name, p.sticker, f.since
       FROM f JOIN profiles p ON p.id = f.id`,
    )
    .bind(me)
    .all();
  const rows = z.array(FriendRowSchema).parse(results);
  const presence = await presenceOf(
    db,
    rows.map((r) => r.id),
    now,
  );
  return sortFriends(
    rows.flatMap((r) => {
      const p = presence.get(r.id);
      return p ? [{ ...r, presence: p }] : [];
    }),
  );
}

/** One friend of mine, with presence (null when not friends). */
export async function friendOf(
  db: D1Database,
  me: string,
  id: string,
  now: number,
): Promise<Friend | null> {
  return (await listFriends(db, me, now)).find((f) => f.id === id) ?? null;
}

const RequestRowSchema = z.object({
  id: z.string(),
  via: z.enum(["code", "link", "handle"]),
  created_at: z.number(),
  from_id: z.string(),
  from_handle: z.string(),
  from_name: z.string(),
  from_sticker: z.string(),
  to_id: z.string(),
  to_handle: z.string(),
  to_name: z.string(),
  to_sticker: z.string(),
});

const REQUEST_SELECT = `SELECT r.id, r.via, r.created_at,
    fp.id AS from_id, fp.handle AS from_handle, fp.name AS from_name, fp.sticker AS from_sticker,
    tp.id AS to_id, tp.handle AS to_handle, tp.name AS to_name, tp.sticker AS to_sticker
  FROM friend_requests r
  JOIN profiles fp ON fp.id = r.from_profile_id
  JOIN profiles tp ON tp.id = r.to_profile_id`;

function toRequest(r: z.infer<typeof RequestRowSchema>): FriendRequest {
  const side = (p: "from" | "to"): PublicProfile => ({
    id: r[`${p}_id`],
    handle: r[`${p}_handle`],
    name: r[`${p}_name`],
    sticker: r[`${p}_sticker`],
  });
  return { id: r.id, from: side("from"), to: side("to"), via: r.via, createdAt: r.created_at };
}

export async function getRequest(db: D1Database, id: string): Promise<FriendRequest | null> {
  const row = await db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).bind(id).first();
  return row ? toRequest(RequestRowSchema.parse(row)) : null;
}

/** Requests to me and from me, newest first. */
export async function listRequests(db: D1Database, me: string) {
  const { results } = await db
    .prepare(
      `${REQUEST_SELECT} WHERE r.to_profile_id = ?1 OR r.from_profile_id = ?1
       ORDER BY r.created_at DESC, r.rowid DESC`,
    )
    .bind(me)
    .all();
  const all = z.array(RequestRowSchema).parse(results).map(toRequest);
  return {
    incoming: all.filter((r) => r.to.id === me),
    outgoing: all.filter((r) => r.from.id === me),
  };
}

async function requestId(db: D1Database, from: string, to: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM friend_requests WHERE from_profile_id = ? AND to_profile_id = ?")
    .bind(from, to)
    .first();
  return row ? z.object({ id: z.string() }).parse(row).id : null;
}

/**
 * I ask them (not yet friends). If they already asked me, both sides confirmed: friends now.
 * Asking again keeps the first request.
 */
export async function ask(
  db: D1Database,
  me: string,
  them: string,
  via: FriendRequest["via"],
  now: number,
): Promise<{ status: "friends" } | { status: "requested"; requestId: string }> {
  if (await requestId(db, them, me)) {
    await befriend(db, me, them, now);
    return { status: "friends" };
  }
  await db
    .prepare(
      `INSERT OR IGNORE INTO friend_requests (id, from_profile_id, to_profile_id, via, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), me, them, via, now)
    .run();
  const id = await requestId(db, me, them);
  if (!id) throw new Error("friend request vanished after insert");
  return { status: "requested", requestId: id };
}

// --- Invites ---

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "23456789";

/** A code like "KITE42" (shown "KITE-42"). */
export function newInviteCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  const letters = Array.from(b.slice(0, 4), (x) => LETTERS[x % LETTERS.length]).join("");
  const digits = Array.from(b.slice(4), (x) => DIGITS[x % DIGITS.length]).join("");
  return letters + digits;
}

/** 32 url-safe characters (24 random bytes). */
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export const DEFAULT_INVITE_BASE_URL = "https://opengame.org/add";

const InviteRowSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  expires_at: z.number(),
  used_at: z.number().nullable(),
  kind: z.enum(["code", "link", "qr"]),
});
export type InviteRow = z.infer<typeof InviteRowSchema>;

/** Creates an invite; retries the rare code collision. */
export async function createInvite(db: D1Database, me: string, baseUrl: string, now: number) {
  const linkToken = newInviteToken();
  const qrToken = newInviteToken();
  const expiresAt = now + INVITE_TTL_MS;
  for (let attempt = 0; ; attempt++) {
    const code = newInviteCode();
    try {
      await db
        .prepare(
          `INSERT INTO friend_invites (id, profile_id, code, link_token, qr_token, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), me, code, linkToken, qrToken, expiresAt)
        .run();
      const base = baseUrl.replace(/\/+$/, "");
      return {
        code: formatInviteCode(code),
        link: `${base}/${linkToken}`,
        qr: `${base}/${qrToken}`,
        expiresAt,
      };
    } catch (e) {
      if (attempt >= 4 || !(e instanceof Error && e.message.includes("UNIQUE"))) throw e;
    }
  }
}

/** The invite a code or token names, and which of its secrets was used. */
export async function findInvite(
  db: D1Database,
  by: { code: string } | { token: string },
): Promise<InviteRow | null> {
  const row =
    "code" in by
      ? await db
          .prepare(
            "SELECT id, profile_id, expires_at, used_at, 'code' AS kind FROM friend_invites WHERE code = ?",
          )
          .bind(by.code)
          .first()
      : await db
          .prepare(
            `SELECT id, profile_id, expires_at, used_at,
               CASE WHEN qr_token = ?1 THEN 'qr' ELSE 'link' END AS kind
             FROM friend_invites WHERE link_token = ?1 OR qr_token = ?1`,
          )
          .bind(by.token)
          .first();
  return row ? InviteRowSchema.parse(row) : null;
}

/** Marks the invite used. False when someone else used it first. */
export async function consumeInvite(db: D1Database, id: string, me: string, now: number) {
  const res = await db
    .prepare("UPDATE friend_invites SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL")
    .bind(now, me, id)
    .run();
  return res.meta.changes > 0;
}

// --- Friends' casts ---

const CastingRowSchema = z.object({
  session_id: z.string(),
  tv_name: z.string(),
  app_id: z.string().nullable(),
  joined: z.number(),
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  sticker: z.string(),
});

/** Live sessions hosted by my friends, newest cast first (the Join cards). */
export async function friendsCasting(
  db: D1Database,
  me: string,
  now: number,
): Promise<CastingFriend[]> {
  const { results } = await db
    .prepare(
      `${FRIENDS_CTE}
       SELECT cs.id AS session_id, cs.tv_name, sl.app_id,
         EXISTS (SELECT 1 FROM session_members sm WHERE sm.session_id = cs.id AND sm.profile_id = ?1) AS joined,
         p.id, p.handle, p.name, p.sticker
       FROM session_live sl
       JOIN couch_sessions cs ON cs.id = sl.session_id
       JOIN profiles p ON p.id = cs.host_profile_id
       WHERE cs.host_profile_id IN (SELECT id FROM f) AND cs.created_at > ?2
       ORDER BY sl.since DESC`,
    )
    .bind(me, now - SESSION_TTL_MS)
    .all();
  return z
    .array(CastingRowSchema)
    .parse(results)
    .map((r) => ({
      sessionId: r.session_id,
      tvName: r.tv_name,
      host: { id: r.id, handle: r.handle, name: r.name, sticker: r.sticker },
      game: gameRef(r.app_id),
      joined: r.joined === 1,
    }));
}

// --- Friends' rooms (several couches, one room: spec §7) ---

const RoomRowSchema = z.object({
  app_id: z.string(),
  room: z.string(),
  since: z.number(),
  session_id: z.string(),
  mine: z.number(),
  friend: z.number(),
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  sticker: z.string(),
});
type RoomRow = z.infer<typeof RoomRowSchema>;

/**
 * Rooms of multiCouch games that a friend's live TV is in (Join with your couch on Playing),
 * newest first. Each lists its couches (my friends' and my own, first to arrive first); a couch
 * is labelled with its host's name.
 */
export async function friendsRooms(db: D1Database, me: string, now: number): Promise<FriendRoom[]> {
  const { results } = await db
    .prepare(
      `${FRIENDS_CTE}
       SELECT sr.app_id, sr.room, sr.since, cs.id AS session_id,
         (cs.host_profile_id = ?1 OR EXISTS (
           SELECT 1 FROM session_members sm WHERE sm.session_id = cs.id AND sm.profile_id = ?1)) AS mine,
         (cs.host_profile_id IN (SELECT id FROM f)) AS friend,
         p.id, p.handle, p.name, p.sticker
       FROM session_rooms sr
       JOIN session_live sl ON sl.session_id = sr.session_id AND sl.app_id = sr.app_id
       JOIN couch_sessions cs ON cs.id = sr.session_id
       JOIN profiles p ON p.id = cs.host_profile_id
       WHERE cs.created_at > ?2
       ORDER BY sr.since, cs.id`,
    )
    .bind(me, now - SESSION_TTL_MS)
    .all();
  const rows = z
    .array(RoomRowSchema)
    .parse(results)
    .filter((r) => (r.mine || r.friend) && findManifest(r.app_id)?.multiCouch === true);
  const groups = new Map<string, RoomRow[]>();
  for (const r of rows) {
    const key = JSON.stringify([r.app_id, r.room]);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()]
    .filter((g) => g.some((r) => r.friend === 1))
    .sort((a, b) => Math.max(...b.map((r) => r.since)) - Math.max(...a.map((r) => r.since)))
    .map((g) => ({
      appId: g[0].app_id,
      game: { appId: g[0].app_id, name: findManifest(g[0].app_id)?.name ?? g[0].app_id },
      room: g[0].room,
      couches: g.map((r) => ({
        sessionId: r.session_id,
        label: r.name,
        host: { id: r.id, handle: r.handle, name: r.name, sticker: r.sticker },
      })),
      joined: g.some((r) => r.mine === 1),
    }));
}
