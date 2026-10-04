import { Hono } from "hono";
import { z } from "zod";
import { handleFromName, isValidHandle, normaliseHandle } from "../lib/handles";
import { apiError, invalidBody, parseBody } from "../lib/http";
import {
  DeviceSchema,
  deviceToken,
  freeHandle,
  isUniqueViolation,
  type Profile,
  upsertDevice,
} from "../lib/profiles";
import type { Env } from "../types";

export const NameSchema = z.string().trim().min(1).max(40);
export const StickerSchema = z.string().trim().min(1).max(40);
export const HandleSchema = z
  .string()
  .transform(normaliseHandle)
  .refine(isValidHandle, "2–24 lowercase letters, digits, dots or underscores");

const CreateProfileSchema = z.object({
  name: NameSchema,
  handle: HandleSchema.optional(),
  sticker: StickerSchema,
  device: DeviceSchema,
});

const profiles = new Hono<{ Bindings: Env }>();

/** GET /api/v1/handles?name= | ?handle= — the @id to pre-fill, whether it's free, and a free one. */
profiles.get("/handles", async (c) => {
  const typed = c.req.query("handle");
  const name = c.req.query("name");
  const handle = typed !== undefined ? normaliseHandle(typed) : name ? handleFromName(name) : null;
  if (!handle || !isValidHandle(handle))
    return invalidBody(c, "name, or a handle of 2–24 lowercase letters, digits, dots or underscores");
  const suggestion = await freeHandle(c.env.DB, handle);
  return c.json({ handle, available: suggestion === handle, suggestion });
});

/** POST /api/v1/profiles — make your OGS profile on this device; answers its device token. */
profiles.post("/profiles", async (c) => {
  const body = await parseBody(c, CreateProfileSchema);
  if (!body) return invalidBody(c, "name, sticker and device { deviceId, kind, name } are required");
  const db = c.env.DB;
  const handle = body.handle ?? (await freeHandle(db, handleFromName(body.name)));
  const profile: Profile = { id: crypto.randomUUID(), handle, name: body.name, sticker: body.sticker };
  try {
    await db.batch([
      db
        .prepare("INSERT INTO profiles (id, handle, name, sticker) VALUES (?, ?, ?, ?)")
        .bind(profile.id, profile.handle, profile.name, profile.sticker),
      upsertDevice(db, profile.id, body.device),
    ]);
  } catch (e) {
    if (isUniqueViolation(e, "handle")) return apiError(c, 409, "handle_taken", "That @id is taken");
    throw e;
  }
  const token = await deviceToken(profile.id, body.device, c.env.OGS_JWT_SECRET);
  return c.json({ profile, token }, 201);
});

export default profiles;
