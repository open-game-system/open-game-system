import { z } from "zod";

/** An invite (code, link, QR) lasts 10 minutes and works once. */
export const INVITE_TTL_MS = 10 * 60 * 1000;

/** A profile seen (a phone or tablet request) in the last 5 minutes is online. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** What a friend sees of you: never your library, logins, devices or other games. */
export const PublicProfileSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  sticker: z.string(),
});
export type PublicProfile = z.infer<typeof PublicProfileSchema>;

export const GameRefSchema = z.object({ appId: z.string(), name: z.string() });
export type GameRef = z.infer<typeof GameRefSchema>;

/** A friend's presence: casting on a TV, playing a game on someone's cast, online, or offline. */
export const PresenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("casting"),
    sessionId: z.string(),
    tvName: z.string(),
    game: GameRefSchema.nullable(),
    /** The game's room on that TV (multiCouch games). */
    room: z.string().optional(),
  }),
  z.object({
    kind: z.literal("playing"),
    sessionId: z.string(),
    tvName: z.string(),
    game: GameRefSchema,
    room: z.string().optional(),
  }),
  z.object({ kind: z.literal("online") }),
  z.object({ kind: z.literal("offline"), lastSeenAt: z.number().nullable() }),
]);
export type Presence = z.infer<typeof PresenceSchema>;

/** A friend in your list. `since`: when you became friends (ms). */
export const FriendSchema = PublicProfileSchema.extend({
  presence: PresenceSchema,
  since: z.number(),
});
export type Friend = z.infer<typeof FriendSchema>;

/** A pending request: `from` asked `to` by typing a code, opening a link, or finding the @id. */
export const FriendRequestSchema = z.object({
  id: z.string(),
  from: PublicProfileSchema,
  to: PublicProfileSchema,
  via: z.enum(["code", "link", "handle"]),
  createdAt: z.number(),
});
export type FriendRequest = z.infer<typeof FriendRequestSchema>;

export const FriendRequestsSchema = z.object({
  incoming: z.array(FriendRequestSchema),
  outgoing: z.array(FriendRequestSchema),
});
export type FriendRequests = z.infer<typeof FriendRequestsSchema>;

/** Add a friend: the code to type, the link to share, the URL the QR encodes, and the expiry (ms). */
export const FriendInviteSchema = z.object({
  code: z.string(),
  link: z.string().url(),
  qr: z.string().url(),
  expiresAt: z.number(),
});
export type FriendInvite = z.infer<typeof FriendInviteSchema>;

/** What someone typed ("kite-42 ") as a code ("KITE42"). */
export const normaliseInviteCode = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, "");

/** "KITE42" → "KITE-42", the way Add a friend shows it. */
export const formatInviteCode = (code: string) => {
  const c = normaliseInviteCode(code);
  return `${c.slice(0, 4)}-${c.slice(4)}`;
};

/** Invite codes: 4 letters, then 2 digits 2–9 (no 0 or 1, so nothing reads as O, I or L). */
const INVITE_CODE = /^[A-Z]{4}[2-9]{2}$/;
export const isInviteCode = (typed: string) => INVITE_CODE.test(normaliseInviteCode(typed));

/** Redeem an invite: a typed code, or the token from a link or a scanned QR. */
export const RedeemInviteSchema = z.union([
  z.object({ code: z.string().transform(normaliseInviteCode).pipe(z.string().min(1)) }),
  z.object({ token: z.string().min(1) }),
]);
export type RedeemInvite = z.infer<typeof RedeemInviteSchema>;

/** Find by @id: the handle with or without the "@", any case. */
export const AddFriendSchema = z.object({
  handle: z
    .string()
    .transform((h) => h.trim().replace(/^@/, "").toLowerCase())
    .pipe(z.string().min(1)),
});

/** What adding someone did: you are friends now, or a request waits for them. */
export const FriendOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("friends"), friend: FriendSchema }),
  z.object({ status: z.literal("requested"), request: FriendRequestSchema }),
]);
export type FriendOutcome = z.infer<typeof FriendOutcomeSchema>;

/** A friend's live cast you may join (the Join card on Playing). */
export const CastingFriendSchema = z.object({
  sessionId: z.string(),
  tvName: z.string(),
  host: PublicProfileSchema,
  game: GameRefSchema.nullable(),
  /** You are already on this cast. */
  joined: z.boolean(),
});
export type CastingFriend = z.infer<typeof CastingFriendSchema>;

/** The invite token in a link or scanned QR: `<any origin>/add/<token>` or `opengame://add/<token>`. */
export function inviteTokenFromUrl(url: string): string | null {
  const match = url.match(
    /^(?:[a-z]+:\/\/[^/?#]+\/|opengame:\/\/)add\/([A-Za-z0-9_-]{16,64})\/?(?:[?#].*)?$/,
  );
  return match ? match[1] : null;
}

/** A session whose TV is connected: its id, TV name and running game. */
export interface LiveSession {
  sessionId: string;
  tvName: string;
  game: GameRef | null;
  /** The game's room on that TV, when it named one. */
  room?: string;
}

/**
 * Presence from what the API knows: the live session a profile hosts, the live session it joined,
 * and when it was last seen. Casting wins, then playing a game, then online.
 */
export function derivePresence(
  input: { hosting: LiveSession | null; joined: LiveSession | null; lastSeenAt: number | null },
  now: number,
): Presence {
  const { hosting, joined, lastSeenAt } = input;
  if (hosting) return { kind: "casting", ...hosting };
  if (joined?.game) return { kind: "playing", ...joined, game: joined.game };
  if (lastSeenAt !== null && now - lastSeenAt < ONLINE_WINDOW_MS) return { kind: "online" };
  return { kind: "offline", lastSeenAt };
}

const RANK: Record<Presence["kind"], number> = { casting: 0, playing: 1, online: 2, offline: 3 };

/** Friends in list order: casting, playing, online, offline; then by name, then @id. */
export function sortFriends<T extends Friend>(friends: readonly T[]): T[] {
  return [...friends].sort(
    (a, b) =>
      RANK[a.presence.kind] - RANK[b.presence.kind] ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      a.handle.localeCompare(b.handle),
  );
}
