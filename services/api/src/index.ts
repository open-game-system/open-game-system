import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiKeyAuth } from "./middleware/auth";
import { anyToken } from "./middleware/profile-auth";
import auth from "./routes/auth";
import cast from "./routes/cast";
import catalogue from "./routes/catalogue";
import clientEvents from "./routes/client-events";
import couch from "./routes/couch";
import devices from "./routes/devices";
import friends from "./routes/friends";
import games from "./routes/games";
import instances from "./routes/instances";
import library from "./routes/library";
import me from "./routes/me";
import notifications from "./routes/notifications";
import profiles from "./routes/profiles";
import sessions from "./routes/sessions";
import stream from "./routes/stream";
import wellKnown from "./routes/well-known";
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

// Profiles (docs/product-specs/ogs-profiles.html): POST /profiles, GET /handles (no token)
app.route("/api/v1", profiles);

// The signed-in profile: profile JWTs, see middleware/profile-auth.ts
app.use("/api/v1/me", anyToken);
app.use("/api/v1/me/*", anyToken);
app.route("/api/v1/me", me);
app.route("/api/v1/me", library);
app.route("/api/v1/me", instances);

// Back up and sign in (Apple, Google, email code)
app.route("/api/v1/auth", auth);

// Couch sessions: one per cast, joined with the TV code
app.route("/api/v1/sessions", sessions);

// Friends (slice 2): invites, requests, the list with presence, friends' casts
app.route("/api/v1/friends", friends);

// Games know who you are (slice 3): game tokens and OGS's public key
app.route("/api/v1/games", games);
app.route("/.well-known", wellKnown);

// Couch session WebSocket (profile or launcher token in ?token=, session in ?session=)
app.route("/api/v1/couch", couch);

// Catalogue of games (public)
app.route("/api/v1/catalogue", catalogue);

// Client wide events (app: profile token; cast receiver: none) → Workers Logs
app.route("/api/v1/client-events", clientEvents);

// Stream routes (no API key required - called by web games directly)
app.route("/api/v1/stream", stream);

export default app;

// Durable Object export — Cloudflare requires DO classes exported from the entry point.
export { CouchSession } from "./couch-session";
export { StreamContainer } from "./stream-container";
// Cloudflare Workers scheduled event handler — exported for wrangler cron triggers.
// In production, wrangler.jsonc wires this via the module's `scheduled` export.
// Tests import handleScheduled directly from ./scheduled.
export { handleScheduled };
