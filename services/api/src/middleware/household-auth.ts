import type { Claims } from "@open-game-system/ogs-protocol";
import type { Context, Next } from "hono";
import { apiError } from "../lib/http";
import { readClaims } from "../lib/identity";
import type { Env } from "../types";

export type HouseholdEnv = { Bindings: Env; Variables: { claims: Claims } };

/** Reads the Bearer header into household claims, or answers with the error contract. */
export async function claimsFromHeader(
  c: Context<HouseholdEnv>,
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

/**
 * Household routes (`/:hid/...`): the Bearer token must be a valid, unexpired household token
 * for that `:hid`, and the household must exist. Sets `claims` for the handlers.
 */
export async function householdAuth(c: Context<HouseholdEnv>, next: Next) {
  const result = await claimsFromHeader(c);
  if ("error" in result) return result.error;
  const { claims } = result;
  if (claims.hid !== c.req.param("hid"))
    return apiError(c, 403, "forbidden_household", "Token belongs to another household");
  const exists = await c.env.DB.prepare("SELECT 1 AS one FROM households WHERE id = ?")
    .bind(claims.hid)
    .first();
  if (!exists) return apiError(c, 404, "household_not_found", "Household not found");
  c.set("claims", claims);
  await next();
}

/** After householdAuth: only a phone token may manage the household (pair devices, mint launcher tokens). */
export async function phoneOnly(c: Context<HouseholdEnv>, next: Next) {
  if (c.get("claims").kind !== "phone")
    return apiError(c, 403, "phone_required", "Only a household phone can do this");
  await next();
}
