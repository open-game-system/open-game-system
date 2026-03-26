import { Hono } from "hono";
import { verifyJwt } from "../lib/jwt";
import { getProviderForPlatform } from "../providers/push";
import { DeviceTokenPayloadSchema, SendNotificationSchema } from "../schemas";
import type { DeviceRow, Env } from "../types";

const notifications = new Hono<{ Bindings: Env }>();

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
  const jwtPayload = await verifyJwt(deviceToken, c.env.OGS_JWT_SECRET);
  if (!jwtPayload) {
    return c.json(
      {
        error: {
          code: "invalid_device_token",
          message: "Device token is invalid or has been tampered with",
          status: 401,
        },
      },
      401,
    );
  }

  const payloadParsed = DeviceTokenPayloadSchema.safeParse(jwtPayload);
  if (!payloadParsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_device_token",
          message: "Device token payload is malformed",
          status: 401,
        },
      },
      401,
    );
  }

  const deviceId = payloadParsed.data.sub;

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

  if (!result.success) {
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

  const notificationId = crypto.randomUUID();

  return c.json({
    id: notificationId,
    status: "sent",
    deviceActive: true,
  });
});

export default notifications;
