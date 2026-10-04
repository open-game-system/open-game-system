import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiKeyAuth } from "./middleware/auth";
import { householdAuth } from "./middleware/household-auth";
import cast from "./routes/cast";
import catalogue from "./routes/catalogue";
import devices from "./routes/devices";
import households from "./routes/households";
import instances from "./routes/instances";
import library from "./routes/library";
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

// Households (OGS app v3 identity): household JWTs, see middleware/household-auth.ts
app.use("/api/v1/households/:hid", householdAuth);
app.use("/api/v1/households/:hid/*", householdAuth);
app.route("/api/v1/households", households);
app.route("/api/v1/households", library);
app.route("/api/v1/households", instances);

// Catalogue of games (public)
app.route("/api/v1/catalogue", catalogue);

// Stream routes (no API key required - called by web games directly)
app.route("/api/v1/stream", stream);

export default app;

// Durable Object export — Cloudflare requires DO classes exported from the entry point.
export { StreamContainer } from "./stream-container";
// Cloudflare Workers scheduled event handler — exported for wrangler cron triggers.
// In production, wrangler.jsonc wires this via the module's `scheduled` export.
// Tests import handleScheduled directly from ./scheduled.
export { handleScheduled };
