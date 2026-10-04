import { SELF } from "cloudflare:test";
import { type Claims, ClaimsSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";

export const BASE = "https://api.test/api/v1";

export const ProfileSchema = z.object({
  id: z.string(),
  handle: z.string(),
  name: z.string(),
  sticker: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const LoginSchema = z.object({
  provider: z.enum(["apple", "google", "email"]),
  email: z.string().nullable(),
});
export const MeSchema = z.object({ profile: ProfileSchema, logins: z.array(LoginSchema) });
export const SignedInSchema = MeSchema.extend({ token: z.string() });

export const CreatedProfileSchema = z.object({ profile: ProfileSchema, token: z.string() });
export type CreatedProfile = z.infer<typeof CreatedProfileSchema>;

export const SessionSchema = z.object({
  sessionId: z.string(),
  code: z.string(),
  tvName: z.string(),
  host: ProfileSchema,
});
export const CreatedSessionSchema = SessionSchema.extend({ token: z.string() });
export type CreatedSession = z.infer<typeof CreatedSessionSchema>;

export const ErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), status: z.number() }),
});

/** Reads a JWT's claims without verifying (the server verifies; tests inspect). */
export function claimsOf(token: string): Claims {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return ClaimsSchema.parse(JSON.parse(atob(payload)));
}

export const bearer = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});
export const json = { "Content-Type": "application/json" };

let seq = 0;
export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

export const device = (kind: "phone" | "tablet" = "phone", name = "iPhone") => ({
  deviceId: unique(kind),
  kind,
  name,
});

/** Makes a profile on a new device; the handle is unique per call unless given. */
export async function createProfile(
  opts: { name?: string; handle?: string; sticker?: string; kind?: "phone" | "tablet" } = {},
): Promise<CreatedProfile> {
  const res = await SELF.fetch(`${BASE}/profiles`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      name: opts.name ?? "Jonathan",
      handle: opts.handle ?? unique("p").replace(/-/g, "."),
      sticker: opts.sticker ?? "bear",
      device: device(opts.kind ?? "phone"),
    }),
  });
  if (res.status !== 201) throw new Error(`createProfile: ${res.status} ${await res.text()}`);
  return CreatedProfileSchema.parse(await res.json());
}

/** The host casts: a session with a launcher token and a TV code. */
export async function createSession(
  host: CreatedProfile,
  tvName = "Living room TV",
): Promise<CreatedSession> {
  const res = await SELF.fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: bearer(host.token),
    body: JSON.stringify({ tvName }),
  });
  if (res.status !== 201) throw new Error(`createSession: ${res.status} ${await res.text()}`);
  return CreatedSessionSchema.parse(await res.json());
}

/** Joins a session with its TV code. */
export async function joinSession(who: CreatedProfile, code: string): Promise<Response> {
  return SELF.fetch(`${BASE}/sessions/join`, {
    method: "POST",
    headers: bearer(who.token),
    body: JSON.stringify({ code }),
  });
}
