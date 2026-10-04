import { z } from "zod";

/**
 * Verifies an OpenID Connect ID token (Sign in with Apple / Google): RS256 signature against the
 * issuer's JWKS (found through its discovery document), issuer, audience (one of our client ids)
 * and expiry. The issuer is configuration, so tests point it at vercel-labs/emulate.
 */
export interface OidcProvider {
  issuer: string;
  /** Accepted `aud` values (our app's client ids). */
  clientIds: string[];
  /** Other spellings of the issuer the provider puts in `iss` (Google: "accounts.google.com"). */
  issuerAliases?: string[];
}

export interface VerifiedLogin {
  subject: string;
  email: string | null;
}

const DiscoverySchema = z.object({ issuer: z.string(), jwks_uri: z.string().url() });
const JwkSchema = z.object({
  kty: z.literal("RSA"),
  kid: z.string(),
  n: z.string(),
  e: z.string(),
  alg: z.string().optional(),
});
const JwksSchema = z.object({ keys: z.array(z.unknown()) });
const HeaderSchema = z.object({ alg: z.literal("RS256"), kid: z.string() });
const IdClaimsSchema = z.object({
  iss: z.string(),
  sub: z.string().min(1),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number(),
  email: z.string().optional(),
  // Apple sends "true"/"false" strings, Google booleans.
  email_verified: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  nonce: z.string().optional(),
});

const decodeSegment = (segment: string): unknown => {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")));
};
const bytesOf = (segment: string) => {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=")), (ch) =>
    ch.charCodeAt(0),
  );
};

async function signingKey(provider: OidcProvider, kid: string, fetcher: typeof fetch) {
  const discovery = DiscoverySchema.parse(
    await (await fetcher(`${provider.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`)).json(),
  );
  const jwks = JwksSchema.parse(await (await fetcher(discovery.jwks_uri)).json());
  const jwk = jwks.keys.map((k) => JwkSchema.safeParse(k)).find((k) => k.success && k.data.kid === kid);
  if (!jwk?.success) return null;
  const { kty, n, e } = jwk.data;
  return crypto.subtle.importKey(
    "jwk",
    { kty, n, e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/** The login inside a valid ID token, or null for anything invalid. */
export async function verifyIdToken(
  idToken: string,
  provider: OidcProvider,
  opts: { now: number; nonce?: string; fetch?: typeof fetch },
): Promise<VerifiedLogin | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const header = HeaderSchema.safeParse(decodeSegment(parts[0]));
    const claims = IdClaimsSchema.safeParse(decodeSegment(parts[1]));
    if (!header.success || !claims.success) return null;
    const c = claims.data;
    const issuers = [provider.issuer.replace(/\/+$/, ""), ...(provider.issuerAliases ?? [])];
    if (!issuers.includes(c.iss)) return null;
    const audiences = typeof c.aud === "string" ? [c.aud] : c.aud;
    if (!audiences.some((a) => provider.clientIds.includes(a))) return null;
    if (c.exp * 1000 <= opts.now) return null;
    if (opts.nonce !== undefined && c.nonce !== opts.nonce) return null;
    const key = await signingKey(provider, header.data.kid, opts.fetch ?? fetch);
    if (!key) return null;
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      bytesOf(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;
    const verifiedEmail = c.email_verified === true || c.email_verified === "true";
    return { subject: c.sub, email: c.email && verifiedEmail ? c.email.toLowerCase() : null };
  } catch {
    return null;
  }
}
