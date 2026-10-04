import { Hono } from "hono";
import { z } from "zod";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { getMe, isHandleFree, isUniqueViolation } from "../lib/profiles";
import { deviceOnly, type ProfileEnv } from "../middleware/profile-auth";
import { HandleSchema, NameSchema, StickerSchema } from "./profiles";

const EditSchema = z.object({
  name: NameSchema.optional(),
  handle: HandleSchema.optional(),
  sticker: StickerSchema.optional(),
});

const NotificationsSchema = z.object({
  friendCasting: z.boolean(),
  friendJoined: z.boolean(),
  yourTurn: z.boolean(),
});
const NotificationsRowSchema = z.object({
  friend_casting: z.number(),
  friend_joined: z.number(),
  your_turn: z.number(),
});

/** The signed-in profile. Mounted at /api/v1/me, behind anyToken; these routes need the device. */
const me = new Hono<ProfileEnv>();
me.use("/", deviceOnly);
me.use("/notifications", deviceOnly);

me.get("/", async (c) => c.json(await getMe(c.env.DB, c.get("claims").sub)));

/** PATCH /me — edit name, @id or sticker; fields not sent stay. */
me.patch("/", async (c) => {
  const body = await parseBody(c, EditSchema);
  if (!body) return invalidBody(c, "name, handle and sticker must be valid when sent");
  const id = c.get("claims").sub;
  const db = c.env.DB;
  if (body.handle !== undefined && !(await isHandleFree(db, body.handle, id)))
    return apiError(c, 409, "handle_taken", "That @id is taken");
  try {
    await db
      .prepare(
        `UPDATE profiles SET name = COALESCE(?, name), handle = COALESCE(?, handle),
           sticker = COALESCE(?, sticker) WHERE id = ?`,
      )
      .bind(body.name ?? null, body.handle ?? null, body.sticker ?? null, id)
      .run();
  } catch (e) {
    if (isUniqueViolation(e, "handle")) return apiError(c, 409, "handle_taken", "That @id is taken");
    throw e;
  }
  return c.json(await getMe(db, id));
});

/** GET /me/notifications — a switch per push type; all on until changed. */
me.get("/notifications", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT friend_casting, friend_joined, your_turn FROM notification_settings WHERE profile_id = ?",
  )
    .bind(c.get("claims").sub)
    .first();
  if (!row) return c.json({ friendCasting: true, friendJoined: true, yourTurn: true });
  const r = NotificationsRowSchema.parse(row);
  return c.json({
    friendCasting: r.friend_casting === 1,
    friendJoined: r.friend_joined === 1,
    yourTurn: r.your_turn === 1,
  });
});

/** PUT /me/notifications — replace every switch. */
me.put("/notifications", async (c) => {
  const body = await parseBody(c, NotificationsSchema);
  if (!body) return invalidBody(c, "friendCasting, friendJoined and yourTurn booleans are required");
  await c.env.DB.prepare(
    `INSERT INTO notification_settings (profile_id, friend_casting, friend_joined, your_turn)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET friend_casting = excluded.friend_casting,
       friend_joined = excluded.friend_joined, your_turn = excluded.your_turn`,
  )
    .bind(c.get("claims").sub, Number(body.friendCasting), Number(body.friendJoined), Number(body.yourTurn))
    .run();
  return c.json(body);
});

export default me;
