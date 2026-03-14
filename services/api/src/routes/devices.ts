import { Hono } from "hono";
import type { Env } from "../types";
import { RegisterDeviceSchema } from "../schemas";
import { signJwt } from "../lib/jwt";

const devices = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/devices/register
 * Registers or updates a device's push token. Returns a signed JWT device token.
 */
devices.post("/register", async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "invalid_body", message: "Request body must be valid JSON", status: 400 } },
      400
    );
  }

  const parsed = RegisterDeviceSchema.safeParse(rawBody);

  if (!parsed.success) {
    const issues = parsed.error.issues;
    // Distinguish "missing field" from "invalid enum value"
    const hasMissingField = issues.some(
      (i) => i.code === "invalid_type"
    );

    if (hasMissingField) {
      return c.json(
        { error: { code: "missing_fields", message: "ogsDeviceId, platform, and pushToken are required", status: 400 } },
        400
      );
    }

    // If all fields present but platform is wrong enum value
    return c.json(
      { error: { code: "invalid_platform", message: "platform must be 'ios' or 'android'", status: 400 } },
      400
    );
  }

  const { ogsDeviceId, platform, pushToken } = parsed.data;

  // Upsert: insert or replace on conflict
  await c.env.DB.prepare(
    `INSERT INTO devices (ogs_device_id, platform, push_token, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(ogs_device_id) DO UPDATE SET
       platform = excluded.platform,
       push_token = excluded.push_token,
       updated_at = datetime('now')`
  )
    .bind(ogsDeviceId, platform, pushToken)
    .run();

  // Sign a JWT device token
  const deviceToken = await signJwt(
    {
      sub: ogsDeviceId,
      iat: Math.floor(Date.now() / 1000),
      iss: "ogs-api",
    },
    c.env.OGS_JWT_SECRET
  );

  return c.json({ deviceId: ogsDeviceId, deviceToken, registered: true });
});

export default devices;
