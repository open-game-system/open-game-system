import { Hono } from "hono";
import { z } from "zod";
import { catalogueIds, findManifest } from "../catalogue";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { type HouseholdEnv, phoneOnly } from "../middleware/household-auth";

const LibrarySchema = z.object({ appIds: z.array(z.string().min(1)).max(200) });
const StoredLibrarySchema = z.array(z.string());
const LibraryRowSchema = z.object({ library: z.string().nullable() });

/** Library of a household. Mounted under /api/v1/households, behind householdAuth. */
const library = new Hono<HouseholdEnv>();

/** GET /:hid/library — the household's games; the whole catalogue until a phone changes it. */
library.get("/:hid/library", async (c) => {
  const row = await c.env.DB.prepare("SELECT library FROM households WHERE id = ?")
    .bind(c.get("claims").hid)
    .first();
  const { library: stored } = LibraryRowSchema.parse(row);
  if (stored === null) return c.json({ appIds: catalogueIds() });
  // Games since removed from the catalogue drop out.
  const appIds = StoredLibrarySchema.parse(JSON.parse(stored)).filter((id) => findManifest(id));
  return c.json({ appIds });
});

/** PUT /:hid/library — replace the household's games (ordered, de-duplicated, catalogue ids only). */
library.put("/:hid/library", phoneOnly, async (c) => {
  const body = await parseBody(c, LibrarySchema);
  if (!body) return invalidBody(c, "appIds must be an array of app ids");
  const unknown = body.appIds.filter((id) => !findManifest(id));
  if (unknown.length)
    return apiError(c, 400, "unknown_app", `Not in the catalogue: ${unknown.join(", ")}`);
  const appIds = [...new Set(body.appIds)];
  await c.env.DB.prepare("UPDATE households SET library = ? WHERE id = ?")
    .bind(JSON.stringify(appIds), c.get("claims").hid)
    .run();
  return c.json({ appIds });
});

export default library;
