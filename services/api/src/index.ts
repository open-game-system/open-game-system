import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { apiKeyAuth } from "./middleware/auth";
import devices from "./routes/devices";
import notifications from "./routes/notifications";
import cast from "./routes/cast";

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

// Cast sessions (API key required - called by native app)
app.use("/api/v1/cast/*", apiKeyAuth);
app.route("/api/v1/cast", cast);

export default app;
