import type { Claims } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { getProfile, type Profile } from "./profiles";

/** A session lives as long as its launcher token. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** TV codes avoid look-alikes (0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** What someone typed ("kit-e42 ") as a code ("KITE42"). */
export const normaliseCode = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, "");

const SessionRowSchema = z.object({
  id: z.string(),
  host_profile_id: z.string(),
  code: z.string(),
  tv_name: z.string(),
  created_at: z.number(),
});
export type SessionRow = z.infer<typeof SessionRowSchema>;

export interface SessionView {
  sessionId: string;
  code: string;
  tvName: string;
  host: Profile;
}

export async function getSession(db: D1Database, sid: string): Promise<SessionRow | null> {
  const row = await db.prepare("SELECT * FROM couch_sessions WHERE id = ?").bind(sid).first();
  return row ? SessionRowSchema.parse(row) : null;
}

export async function findByCode(db: D1Database, code: string, now: number) {
  const row = await db
    .prepare("SELECT * FROM couch_sessions WHERE code = ? AND created_at > ?")
    .bind(code, now - SESSION_TTL_MS)
    .first();
  return row ? SessionRowSchema.parse(row) : null;
}

export async function viewOf(db: D1Database, row: SessionRow): Promise<SessionView | null> {
  const host = await getProfile(db, row.host_profile_id);
  return host ? { sessionId: row.id, code: row.code, tvName: row.tv_name, host } : null;
}

/** May these claims enter the session? Its own launcher, its host, or a profile that joined. */
export async function mayEnter(db: D1Database, claims: Claims, row: SessionRow): Promise<boolean> {
  if (claims.kind === "launcher") return claims.sid === row.id;
  if (claims.sub === row.host_profile_id) return true;
  const member = await db
    .prepare("SELECT 1 AS one FROM session_members WHERE session_id = ? AND profile_id = ?")
    .bind(row.id, claims.sub)
    .first();
  return member !== null;
}
