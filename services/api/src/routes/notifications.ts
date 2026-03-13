import { Hono } from "hono";
import type { Env, DeviceRow, SendNotificationRequest } from "../types";
import { getProviderForPlatform } from "../providers/push";

const notifications = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/notifications/send
 * Sends a push notification to a device. Requires API key auth (applied in index.ts).
 */
notifications.post("/send", async (c) => {
  let body: SendNotificationRequest;
  try {
    body = await c.req.json<SendNotificationRequest>();
  } catch {
    return c.json(
      { error: { code: "invalid_body", message: "Request body must be valid JSON", status: 400 } },
      400
    );
  }

  const { deviceId, notification } = body;

  if (!deviceId || !notification?.title || !notification?.body) {
    return c.json(
      {
        error: {
          code: "missing_fields",
          message: "deviceId, notification.title, and notification.body are required",
          status: 400,
        },
      },
      400
    );
  }

  // Look up the device
  const device = await c.env.DB.prepare(
    "SELECT ogs_device_id, platform, push_token FROM devices WHERE ogs_device_id = ?"
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
      404
    );
  }

  // Send via the appropriate push provider
  const provider = getProviderForPlatform(device.platform);
  const result = await provider.send(device.push_token, {
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });

  if (!result.success) {
    return c.json(
      {
        error: {
          code: "push_failed",
          message: result.error ?? "Failed to send push notification",
          status: 502,
        },
      },
      502
    );
  }

  const notificationId = crypto.randomUUID();

  return c.json({
    id: notificationId,
    status: "sent",
  });
});

export default notifications;
