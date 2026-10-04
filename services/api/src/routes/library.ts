import { Hono } from "hono";
import { z } from "zod";
import { catalogueIds, findManifest } from "../catalogue";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { deviceOnly, type ProfileEnv } from "../middleware/profile-auth";

const LibrarySchema = z.object({ appIds: z.array(z.string().min(1)).max(200) });
const StoredLibrarySchema = z.array(z.string());
const LibraryRowSchema = z.object({ library: z.string().nullable() });

/** The games a profile has. Mounted under /api/v1/me, behind anyToken (a launcher reads its host's). */
const library = new Hono<ProfileEnv>();

/** GET /me/library — the profile's games; the whole catalogue until it changes them. */
library.get("/library", async (c) => {
  const row = await c.env.DB.prepare("SELECT library FROM profiles WHERE id = ?")
    .bind(c.get("claims").sub)
    .first();
  const { library: stored } = LibraryRowSchema.parse(row);
  if (stored === null) return c.json({ appIds: catalogueIds() });
  // Games since removed from the catalogue drop out.
  const appIds = StoredLibrarySchema.parse(JSON.parse(stored)).filter((id) => findManifest(id));
  return c.json({ appIds });
});

/** PUT /me/library — replace the profile's games (ordered, de-duplicated, catalogue ids only). */
library.put("/library", deviceOnly, async (c) => {
  const body = await parseBody(c, LibrarySchema);
  if (!body) return invalidBody(c, "appIds must be an array of app ids");
  const unknown = body.appIds.filter((id) => !findManifest(id));
  if (unknown.length)
    return apiError(c, 400, "unknown_app", `Not in the catalogue: ${unknown.join(", ")}`);
  const appIds = [...new Set(body.appIds)];
  await c.env.DB.prepare("UPDATE profiles SET library = ? WHERE id = ?")
    .bind(JSON.stringify(appIds), c.get("claims").sub)
    .run();
  return c.json({ appIds });
});

export default library;
