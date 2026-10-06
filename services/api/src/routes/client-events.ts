import { Hono } from "hono";
import { z } from "zod";
import { apiError, invalidBody } from "../lib/http";
import { claimsFromHeader, type ProfileEnv } from "../middleware/profile-auth";

/**
 * POST /api/v1/client-events: wide events from the app and the cast receiver. Each event becomes
 * one structured JSON line in Workers Logs (console.log; console.error for level "error"), which
 * is what the SRE agent reads and fingerprints. Nothing is stored.
 *
 * The app sends its profile token; the receiver has no credentials and may post without one
 * (marked `authenticated: false`, limited per IP). Tokens never reach the log: token= query
 * values and JWT-looking strings are redacted, secret-named data keys dropped.
 */

/** 64 KB per batch. */
export const MAX_BATCH_BYTES = 64 * 1024;
export const MAX_EVENTS = 50;

const Scalar = z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]);
const Name = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_.:-]+$/i);

const EventSchema = z.object({
  name: Name,
  at: z.number().int().nonnegative(),
  level: z.enum(["debug", "info", "warn", "error"]),
  attemptId: z.string().max(64).optional(),
  durationMs: z.number().nonnegative().optional(),
  error: z.string().max(MAX_BATCH_BYTES).optional(),
  data: z.record(z.string().max(64), Scalar).optional(),
});

const ContextSchema = z.object({
  app: z.enum(["mobile", "receiver"]),
  build: z.string().max(64).optional(),
  version: z.string().max(64).optional(),
  platform: z.string().max(64).optional(),
  profileId: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
  deviceHash: z.string().max(64).optional(),
});

const BatchSchema = z.object({
  context: ContextSchema,
  events: z.array(EventSchema).min(1).max(MAX_EVENTS),
});

type ClientEvent = z.infer<typeof EventSchema>;

const SECRET_KEY = /token|secret|password|authorization|cookie/i;

/** Takes token= query values and JWT-looking strings out of a logged string. */
export function redact(text: string): string {
  return text
    .replace(/([?&#]token=)[^&#\s"]+/gi, "$1REDACTED")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "REDACTED");
}

function redactData(data: ClientEvent["data"]) {
  if (!data) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = typeof value === "string" ? redact(value) : value;
  }
  return out;
}

const clientEvents = new Hono<ProfileEnv>();

clientEvents.post("/", async (c) => {
  const declared = Number(c.req.header("Content-Length") ?? "0");
  if (declared > MAX_BATCH_BYTES) return tooLarge(c);
  const text = await c.req.text();
  if (text.length > MAX_BATCH_BYTES) return tooLarge(c);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return invalidBody(c, "Body must be JSON");
  }
  const parsed = BatchSchema.safeParse(raw);
  if (!parsed.success)
    return invalidBody(c, `context and 1-${MAX_EVENTS} events ({ name, at, level }) are required`);
  const { context, events } = parsed.data;

  // The app always sends its token; only the receiver (no credentials) may post without one.
  let profileId: string | undefined;
  if (c.req.header("Authorization") || context.app !== "receiver") {
    const result = await claimsFromHeader(c);
    if ("error" in result) return result.error;
    profileId = result.claims.sub;
  }

  const key = profileId
    ? `profile:${profileId}`
    : `receiver:${c.req.header("CF-Connecting-IP") ?? "unknown"}`;
  const limiter = c.env.CLIENT_EVENTS_LIMITER;
  if (limiter && !(await limiter.limit({ key })).success)
    return apiError(c, 429, "rate_limited", "Too many client events; try again in a minute");

  const receivedAt = Date.now();
  for (const event of events) {
    const line = JSON.stringify({
      kind: "client_event",
      source: context.app,
      authenticated: profileId !== undefined,
      build: context.build,
      version: context.version,
      platform: context.platform,
      sessionId: context.sessionId,
      deviceHash: context.deviceHash,
      // The token's profile, never the one the client claims.
      profileId,
      receivedAt,
      name: event.name,
      level: event.level,
      at: event.at,
      attemptId: event.attemptId,
      durationMs: event.durationMs,
      error: event.error === undefined ? undefined : redact(event.error),
      data: redactData(event.data),
    });
    if (event.level === "error") console.error(line);
    else console.log(line);
  }
  return c.json({ accepted: events.length }, 202);
});

const tooLarge = (c: Parameters<typeof apiError>[0]) =>
  apiError(c, 413, "payload_too_large", `A batch is at most ${MAX_BATCH_BYTES} bytes`);

export default clientEvents;
