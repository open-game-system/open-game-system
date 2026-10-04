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
    await (
      await fetcher(`${provider.issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`)
    ).json(),
  );
  const jwks = JwksSchema.parse(await (await fetcher(discovery.jwks_uri)).json());
  const jwk = jwks.keys
    .map((k) => JwkSchema.safeParse(k))
    .find((k) => k.success && k.data.kid === kid);
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
    const token = parseToken(idToken);
    if (!token || !issuedForUs(token.claims, provider) || !current(token.claims, opts)) return null;
    const valid = await signedByProvider(token, provider, opts.fetch ?? fetch);
    return valid ? loginOf(token.claims) : null;
  } catch {
    return null;
  }
}

type IdClaims = z.infer<typeof IdClaimsSchema>;

interface ParsedToken {
  kid: string;
  claims: IdClaims;
  signed: Uint8Array;
  signature: Uint8Array;
}

/** Header + claims of a three-segment RS256 token, or null when either doesn't parse. */
function parseToken(idToken: string): ParsedToken | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const header = HeaderSchema.safeParse(decodeSegment(parts[0]));
  const claims = IdClaimsSchema.safeParse(decodeSegment(parts[1]));
  if (!header.success || !claims.success) return null;
  return {
    kid: header.data.kid,
    claims: claims.data,
    signed: new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    signature: bytesOf(parts[2]),
  };
}

/** Issued by the provider (or one of its aliases) for one of our client ids. */
function issuedForUs(c: IdClaims, provider: OidcProvider) {
  const issuers = [provider.issuer.replace(/\/+$/, ""), ...(provider.issuerAliases ?? [])];
  const audiences = typeof c.aud === "string" ? [c.aud] : c.aud;
  return issuers.includes(c.iss) && audiences.some((a) => provider.clientIds.includes(a));
}

/** Not expired, and carrying the expected nonce when one is expected. */
function current(c: IdClaims, opts: { now: number; nonce?: string }) {
  return c.exp * 1000 > opts.now && (opts.nonce === undefined || c.nonce === opts.nonce);
}

async function signedByProvider(token: ParsedToken, provider: OidcProvider, fetcher: typeof fetch) {
  const key = await signingKey(provider, token.kid, fetcher);
  return (
    key !== null && crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, token.signature, token.signed)
  );
}

function loginOf(c: IdClaims): VerifiedLogin {
  const verifiedEmail = c.email_verified === true || c.email_verified === "true";
  return { subject: c.sub, email: c.email && verifiedEmail ? c.email.toLowerCase() : null };
}
