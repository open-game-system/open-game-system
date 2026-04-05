import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiKeyAuth } from "./middleware/auth";
import cast from "./routes/cast";
import devices from "./routes/devices";
import notifications from "./routes/notifications";
import stream from "./routes/stream";
import { handleScheduled } from "./scheduled";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

// Global CORS
app.use("*", cors());

// Health check
app.get("/api/v1/health", (c) => {
  return c.json({ status: "ok" });
});

// Device registration (no API key required - called by the OGS app)
app.route("/api/v1/devices", devices);

// Notifications (API key required - called by game servers)
app.use("/api/v1/notifications/*", apiKeyAuth);
app.route("/api/v1/notifications", notifications);

// Cast sessions (API key required for session management, not for stream proxy)
app.use("/api/v1/cast/sessions/*", apiKeyAuth);
app.use("/api/v1/cast/sessions", apiKeyAuth);
// /api/v1/cast/stream/* is unauthenticated (called by Chromecast receiver)
app.route("/api/v1/cast", cast);

// Stream routes (no API key required - called by web games directly)
app.route("/api/v1/stream", stream);

export default app;

// Cloudflare Workers scheduled event handler — exported for wrangler cron triggers.
// In production, wrangler.jsonc wires this via the module's `scheduled` export.
// Tests import handleScheduled directly from ./scheduled.
export { handleScheduled };

// Durable Object export — Cloudflare requires DO classes exported from the entry point.
export { StreamContainer } from "./stream-container";
