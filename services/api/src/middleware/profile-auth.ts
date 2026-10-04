import type { Claims } from "@open-game-system/ogs-protocol";
import type { Context, Next } from "hono";
import { apiError } from "../lib/http";
import { readClaims } from "../lib/identity";
import type { Env } from "../types";

export type ProfileEnv = { Bindings: Env; Variables: { claims: Claims } };

/** Reads the Bearer header into profile claims, or answers with the error contract. */
export async function claimsFromHeader(
  c: Context<ProfileEnv>,
): Promise<{ claims: Claims } | { error: Response }> {
  const header = c.req.header("Authorization");
  if (!header)
    return { error: apiError(c, 401, "missing_auth", "Authorization header is required") };
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match)
    return {
      error: apiError(c, 401, "invalid_auth", "Authorization header must use Bearer scheme"),
    };
  const claims = await readClaims(match[1], c.env.OGS_JWT_SECRET, Date.now());
  if (!claims) return { error: apiError(c, 401, "invalid_token", "Token is invalid or expired") };
  return { claims };
}

/** Any valid token whose profile exists: a phone, a tablet, or a launcher (acting for its host). */
export async function anyToken(c: Context<ProfileEnv>, next: Next) {
  const result = await claimsFromHeader(c);
  if ("error" in result) return result.error;
  const exists = await c.env.DB.prepare("SELECT 1 AS one FROM profiles WHERE id = ?")
    .bind(result.claims.sub)
    .first();
  if (!exists) return apiError(c, 404, "profile_not_found", "Profile not found");
  c.set("claims", result.claims);
  await next();
}

/** After anyToken: only the profile's own phone or tablet (not a TV launcher). */
export async function deviceOnly(c: Context<ProfileEnv>, next: Next) {
  if (c.get("claims").kind === "launcher")
    return apiError(c, 403, "profile_token_required", "Needs the profile's phone or tablet token");
  await next();
}
