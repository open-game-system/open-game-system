import { type Context, Hono } from "hono";
import { verifyJwt } from "../lib/jwt";
import { getProviderForPlatform, type PushResult } from "../providers/push";
import { DeviceTokenPayloadSchema, SendNotificationSchema } from "../schemas";
import type { DeviceRow, Env } from "../types";

type NotificationsEnv = { Bindings: Env };
const notifications = new Hono<NotificationsEnv>();

/** The device id inside a signed device token, or why it isn't one. */
async function deviceIdOf(
  token: string,
  secret: string,
): Promise<{ deviceId: string } | { problem: string }> {
  const payload = await verifyJwt(token, secret);
  if (!payload) return { problem: "Device token is invalid or has been tampered with" };
  const parsed = DeviceTokenPayloadSchema.safeParse(payload);
  return parsed.success
    ? { deviceId: parsed.data.sub }
    : { problem: "Device token payload is malformed" };
}

/** 502 push_failed; a device Expo says is gone is forgotten first. */
async function pushFailed(c: Context<NotificationsEnv>, deviceId: string, result: PushResult) {
  if (!result.deviceActive) {
    await c.env.DB.prepare("DELETE FROM devices WHERE ogs_device_id = ?").bind(deviceId).run();
  }
  return c.json(
    {
      error: {
        code: "push_failed",
        message: result.error ?? "Failed to send push notification",
        status: 502,
      },
      deviceActive: result.deviceActive,
    },
    502,
  );
}

/**
 * POST /api/v1/notifications/send
 * Sends a push notification to a device. Requires API key auth (applied in index.ts).
 * Accepts a signed JWT deviceToken instead of a raw device ID.
 */
notifications.post("/send", async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "invalid_body", message: "Request body must be valid JSON", status: 400 } },
      400,
    );
  }

  const parsed = SendNotificationSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "missing_fields",
          message: "deviceToken, notification.title, and notification.body are required",
          status: 400,
        },
      },
      400,
    );
  }

  const { deviceToken, notification } = parsed.data;

  // Verify JWT signature and extract device ID
  const verified = await deviceIdOf(deviceToken, c.env.OGS_JWT_SECRET);
  if ("problem" in verified) {
    return c.json(
      { error: { code: "invalid_device_token", message: verified.problem, status: 401 } },
      401,
    );
  }
  const { deviceId } = verified;

  // Look up the device
  const device = await c.env.DB.prepare(
    "SELECT ogs_device_id, platform, push_token FROM devices WHERE ogs_device_id = ?",
  )
    .bind(deviceId)
    .first<DeviceRow>();

  if (!device) {
    return c.json(
      {
        error: {
          code: "device_not_found",
          message: `No device registered with id '${deviceId}'`,
          status: 404,
        },
      },
      404,
    );
  }

  // Send via Expo Push
  const provider = getProviderForPlatform(device.platform);
  const result = await provider.send(device.push_token, {
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });

  if (!result.success) return pushFailed(c, deviceId, result);

  const notificationId = crypto.randomUUID();

  return c.json({
    id: notificationId,
    status: "sent",
    deviceActive: true,
  });
});

export default notifications;
