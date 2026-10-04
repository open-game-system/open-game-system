import {
  type Instance,
  InstanceReportSchema,
  InstanceSchema,
  InstanceStatusSchema,
} from "@open-game-system/ogs-protocol";
import { Hono } from "hono";
import { z } from "zod";
import { findManifest } from "../catalogue";
import { apiError, invalidBody, parseBody } from "../lib/http";
import type { ProfileEnv } from "../middleware/profile-auth";

/** A client report: the game's own report over the bridge, or the app recording a visit (Tier 0). */
const ClientReportSchema = InstanceReportSchema.extend({
  source: InstanceSchema.shape.source.exclude(["server"]),
});

const InstanceRowSchema = z.object({
  profile_id: z.string(),
  instance_id: z.string(),
  app_id: z.string(),
  status: z.enum(InstanceStatusSchema.options),
  title: z.string(),
  detail: z.string(),
  your_turn: z.number().nullable(),
  starts_at: z.number().nullable(),
  resume_url: z.string().nullable(),
  source: z.enum(InstanceSchema.shape.source.options),
  updated_at: z.number(),
});

function toInstance(row: z.infer<typeof InstanceRowSchema>): Instance {
  return InstanceSchema.parse({
    instanceId: row.instance_id,
    appId: row.app_id,
    profileId: row.profile_id,
    status: row.status,
    title: row.title,
    detail: row.detail,
    yourTurn: row.your_turn === null ? undefined : row.your_turn === 1,
    startsAt: row.starts_at ?? undefined,
    resumeUrl: row.resume_url ?? undefined,
    updatedAt: row.updated_at,
    source: row.source,
  });
}

/** Inserts or replaces the profile's instance (by instance id). */
function upsertInstance(db: D1Database, instance: Instance) {
  return db
    .prepare(
      `INSERT INTO instances (profile_id, instance_id, app_id, status, title, detail, your_turn,
         starts_at, resume_url, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_id, instance_id) DO UPDATE SET
         app_id = excluded.app_id, status = excluded.status, title = excluded.title,
         detail = excluded.detail, your_turn = excluded.your_turn, starts_at = excluded.starts_at,
         resume_url = excluded.resume_url, source = excluded.source, updated_at = excluded.updated_at`,
    )
    .bind(
      instance.profileId,
      instance.instanceId,
      instance.appId,
      instance.status,
      instance.title,
      instance.detail,
      instance.yourTurn === undefined ? null : Number(instance.yourTurn),
      instance.startsAt ?? null,
      instance.resumeUrl ?? null,
      instance.source,
      instance.updatedAt,
    )
    .run();
}

/** A profile's instances. Mounted under /api/v1/me, behind anyToken (a launcher acts for its host). */
const instances = new Hono<ProfileEnv>();

/** POST /me/instances — upsert a report from the profile's device or its TV; updatedAt = now. */
instances.post("/instances", async (c) => {
  const report = await parseBody(c, ClientReportSchema);
  if (!report)
    return invalidBody(c, "instanceId, appId, status and source (bridge|visit) are required");
  if (!findManifest(report.appId))
    return apiError(c, 400, "unknown_app", `Not in the catalogue: ${report.appId}`);
  const instance: Instance = {
    ...report,
    profileId: c.get("claims").sub,
    updatedAt: Date.now(),
  };
  await upsertInstance(c.env.DB, instance);
  return c.json(instance);
});

/** GET /me/instances — every instance of the profile, newest first (clients run playingView). */
instances.get("/instances", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM instances WHERE profile_id = ? ORDER BY updated_at DESC, rowid DESC",
  )
    .bind(c.get("claims").sub)
    .all();
  return c.json(z.array(InstanceRowSchema).parse(results).map(toInstance));
});

export default instances;
