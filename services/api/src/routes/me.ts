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

/** The signed-in profile. Mounted at /api/v1/me, behind anyToken; these routes need the device. */
const me = new Hono<ProfileEnv>();
me.use("/", deviceOnly);

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

export default me;
