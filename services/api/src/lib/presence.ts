import {
  derivePresence,
  type GameRef,
  type LiveSession,
  type Presence,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { findManifest } from "../catalogue";
import { SESSION_TTL_MS } from "./sessions";

/** Last-seen writes are skipped while the stored one is younger than this. */
const SEEN_RESOLUTION_MS = 60_000;

/** Records that the profile's phone or tablet reached the API (at most one write a minute). */
export function markSeen(db: D1Database, profileId: string, now: number) {
  return db
    .prepare(
      `INSERT INTO profile_seen (profile_id, last_seen_at) VALUES (?1, ?2)
       ON CONFLICT(profile_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
       WHERE excluded.last_seen_at - profile_seen.last_seen_at >= ?3`,
    )
    .bind(profileId, now, SEEN_RESOLUTION_MS)
    .run();
}

/** The CouchSession DO says whether its TV is connected and which game runs (null: not live). */
export function recordLive(
  db: D1Database,
  sessionId: string,
  live: { appId: string | null } | null,
  now: number,
) {
  if (!live)
    return db.prepare("DELETE FROM session_live WHERE session_id = ?").bind(sessionId).run();
  return db
    .prepare(
      `INSERT INTO session_live (session_id, app_id, since) VALUES (?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET app_id = excluded.app_id`,
    )
    .bind(sessionId, live.appId, now)
    .run();
}

/** The game's room on the session's TV (null: it names none). */
export function recordRoom(
  db: D1Database,
  sessionId: string,
  room: { appId: string; room: string } | null,
  now: number,
) {
  if (!room)
    return db.prepare("DELETE FROM session_rooms WHERE session_id = ?").bind(sessionId).run();
  return db
    .prepare(
      `INSERT INTO session_rooms (session_id, app_id, room, since) VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET app_id = excluded.app_id, room = excluded.room, since = excluded.since`,
    )
    .bind(sessionId, room.appId, room.room, now)
    .run();
}

type LiveRoom = { appId: string; room: string } | null;
const liveRoom = (s: SessionState): LiveRoom =>
  s.cast && s.current?.room ? { appId: s.current.appId, room: s.current.room } : null;

/** What to write to session_rooms after a message: `{ room }` (null clears), or null for nothing. */
export function roomChange(before: SessionState, after: SessionState): { room: LiveRoom } | null {
  const [a, b] = [liveRoom(before), liveRoom(after)];
  return a?.appId === b?.appId && a?.room === b?.room ? null : { room: b };
}

export const gameRef = (appId: string | null): GameRef | null =>
  appId === null ? null : { appId, name: findManifest(appId)?.name ?? appId };

const LiveRowSchema = z.object({
  pid: z.string(),
  session_id: z.string(),
  tv_name: z.string(),
  app_id: z.string().nullable(),
  room: z.string().nullable(),
});
const SeenRowSchema = z.object({ profile_id: z.string(), last_seen_at: z.number() });

const live = (r: z.infer<typeof LiveRowSchema>): LiveSession => ({
  sessionId: r.session_id,
  tvName: r.tv_name,
  game: gameRef(r.app_id),
  ...(r.room && r.app_id ? { room: r.room } : {}),
});

/** First row per profile (rows come newest cast first). */
function firstBy(rows: z.infer<typeof LiveRowSchema>[]): Map<string, LiveSession> {
  const out = new Map<string, LiveSession>();
  for (const r of rows) if (!out.has(r.pid)) out.set(r.pid, live(r));
  return out;
}

/** Presence of each profile: the live session it hosts, the one it joined, and last seen. */
export async function presenceOf(
  db: D1Database,
  ids: readonly string[],
  now: number,
): Promise<Map<string, Presence>> {
  const list = JSON.stringify(ids);
  const fresh = now - SESSION_TTL_MS;
  const [hosting, joined, seen] = await db.batch([
    db
      .prepare(
        `SELECT cs.host_profile_id AS pid, cs.id AS session_id, cs.tv_name, sl.app_id, sr.room
         FROM session_live sl JOIN couch_sessions cs ON cs.id = sl.session_id
         LEFT JOIN session_rooms sr ON sr.session_id = sl.session_id AND sr.app_id = sl.app_id
         WHERE cs.host_profile_id IN (SELECT value FROM json_each(?1)) AND cs.created_at > ?2
         ORDER BY sl.since DESC`,
      )
      .bind(list, fresh),
    db
      .prepare(
        `SELECT sm.profile_id AS pid, cs.id AS session_id, cs.tv_name, sl.app_id, sr.room
         FROM session_members sm
         JOIN couch_sessions cs ON cs.id = sm.session_id
         JOIN session_live sl ON sl.session_id = cs.id
         LEFT JOIN session_rooms sr ON sr.session_id = sl.session_id AND sr.app_id = sl.app_id
         WHERE sm.profile_id IN (SELECT value FROM json_each(?1)) AND cs.created_at > ?2
         ORDER BY sl.since DESC`,
      )
      .bind(list, fresh),
    db
      .prepare(
        "SELECT profile_id, last_seen_at FROM profile_seen WHERE profile_id IN (SELECT value FROM json_each(?1))",
      )
      .bind(list),
  ]);
  const host = firstBy(z.array(LiveRowSchema).parse(hosting.results));
  const member = firstBy(z.array(LiveRowSchema).parse(joined.results));
  const lastSeen = new Map(
    z
      .array(SeenRowSchema)
      .parse(seen.results)
      .map((r) => [r.profile_id, r.last_seen_at]),
  );
  return new Map(
    ids.map((id) => [
      id,
      derivePresence(
        {
          hosting: host.get(id) ?? null,
          joined: member.get(id) ?? null,
          lastSeenAt: lastSeen.get(id) ?? null,
        },
        now,
      ),
    ]),
  );
}
