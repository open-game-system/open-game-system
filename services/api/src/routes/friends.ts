import {
  AddFriendSchema,
  type FriendOutcome,
  RedeemInviteSchema,
} from "@open-game-system/ogs-protocol";
import { type Context, Hono } from "hono";
import {
  areFriends,
  ask,
  befriend,
  consumeInvite,
  createInvite,
  DEFAULT_INVITE_BASE_URL,
  findInvite,
  friendOf,
  friendsCasting,
  getRequest,
  listFriends,
  listRequests,
  unfriend,
} from "../lib/friends";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { anyToken, deviceOnly, type ProfileEnv } from "../middleware/profile-auth";

/** Friends (slice 2): mutual, request → accept; QR accepts at once. Mounted at /api/v1/friends. */
const friends = new Hono<ProfileEnv>();
friends.use("*", anyToken, deviceOnly);

const meOf = (c: Context<ProfileEnv>) => c.get("claims").sub;

/** 200 `{ status: "friends", friend }` with the friend's presence. */
async function friendsWith(c: Context<ProfileEnv>, id: string) {
  const friend = await friendOf(c.env.DB, meOf(c), id, Date.now());
  if (!friend) throw new Error("friendship missing right after it was made");
  const body: FriendOutcome = { status: "friends", friend };
  return c.json(body, 200);
}

/** 201 `{ status: "requested", request }`. */
async function requested(c: Context<ProfileEnv>, requestId: string) {
  const request = await getRequest(c.env.DB, requestId);
  if (!request) throw new Error("request missing right after it was made");
  const body: FriendOutcome = { status: "requested", request };
  return c.json(body, 201);
}

/** I ask them; when they had asked me, we are friends now. */
async function askOrAccept(c: Context<ProfileEnv>, them: string, via: "code" | "link" | "handle") {
  const result = await ask(c.env.DB, meOf(c), them, via, Date.now());
  return result.status === "friends" ? friendsWith(c, them) : requested(c, result.requestId);
}

/** GET /friends — my friends with presence: casting, playing, online, offline; then name. */
friends.get("/", async (c) => c.json(await listFriends(c.env.DB, meOf(c), Date.now())));

/** GET /friends/casting — friends whose TV is live (the Join cards on Playing). */
friends.get("/casting", async (c) => c.json(await friendsCasting(c.env.DB, meOf(c), Date.now())));

/** POST /friends/invites — Add a friend: a code, a link and a QR url; 10 min, single use. */
friends.post("/invites", async (c) => {
  const base = c.env.INVITE_BASE_URL || DEFAULT_INVITE_BASE_URL;
  return c.json(await createInvite(c.env.DB, meOf(c), base, Date.now()), 201);
});

/** POST /friends/invites/redeem — a scanned QR makes friends; a code or link sends a request. */
friends.post("/invites/redeem", async (c) => {
  const body = await parseBody(c, RedeemInviteSchema);
  if (!body)
    return invalidBody(c, "code (the code on their screen) or token (from the link) is required");
  const db = c.env.DB;
  const me = meOf(c);
  const now = Date.now();
  const invite = await findInvite(db, body);
  if (!invite) return apiError(c, 404, "invite_not_found", "No invite has that code");
  const them = invite.profile_id;
  if (them === me) return apiError(c, 409, "cannot_friend_self", "That's your own invite");
  if (await areFriends(db, me, them)) return friendsWith(c, them);
  if (invite.used_at !== null)
    return apiError(c, 410, "invite_used", "That invite was already used");
  if (invite.expires_at <= now) return apiError(c, 410, "invite_expired", "That invite expired");
  if (!(await consumeInvite(db, invite.id, me, now)))
    return apiError(c, 410, "invite_used", "That invite was already used");
  if (invite.kind === "qr") {
    await befriend(db, me, them, now);
    return friendsWith(c, them);
  }
  return askOrAccept(c, them, invite.kind);
});

/** POST /friends/requests — find by @id. */
friends.post("/requests", async (c) => {
  const body = await parseBody(c, AddFriendSchema);
  if (!body) return invalidBody(c, "handle (their @id) is required");
  const db = c.env.DB;
  const me = meOf(c);
  const row = await db
    .prepare("SELECT id FROM profiles WHERE handle = ?")
    .bind(body.handle)
    .first();
  const them = row && typeof row.id === "string" ? row.id : null;
  if (!them) return apiError(c, 404, "handle_not_found", "Nobody has that @id");
  if (them === me) return apiError(c, 409, "cannot_friend_self", "That's your own @id");
  if (await areFriends(db, me, them))
    return apiError(c, 409, "already_friends", "You are already friends");
  return askOrAccept(c, them, "handle");
});

/** GET /friends/requests — `{ incoming, outgoing }`, newest first. */
friends.get("/requests", async (c) => c.json(await listRequests(c.env.DB, meOf(c))));

/** POST /friends/requests/:id/accept — the recipient accepts. */
friends.post("/requests/:id/accept", async (c) => {
  const request = await getRequest(c.env.DB, c.req.param("id"));
  if (!request || request.to.id !== meOf(c))
    return apiError(c, 404, "request_not_found", "No such request for you");
  await befriend(c.env.DB, request.from.id, request.to.id, Date.now());
  return friendsWith(c, request.from.id);
});

/** POST /friends/requests/:id/decline — the recipient declines, or the sender withdraws. */
friends.post("/requests/:id/decline", async (c) => {
  const me = meOf(c);
  const res = await c.env.DB.prepare(
    "DELETE FROM friend_requests WHERE id = ?1 AND (to_profile_id = ?2 OR from_profile_id = ?2)",
  )
    .bind(c.req.param("id"), me)
    .run();
  if (res.meta.changes === 0)
    return apiError(c, 404, "request_not_found", "No such request for you");
  return c.body(null, 204);
});

/** DELETE /friends/:profileId — no longer friends, for both. */
friends.delete("/:profileId", async (c) => {
  if (!(await unfriend(c.env.DB, meOf(c), c.req.param("profileId"))))
    return apiError(c, 404, "friend_not_found", "You are not friends");
  return c.body(null, 204);
});

export default friends;
