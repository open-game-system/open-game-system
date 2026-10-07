import { type CouchClaim, type GameToken, GameTokenSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";
import { base64UrlToBytes, jsonPart } from "./token";

export type { CouchClaim, GameToken };

/** OGS's public signing keys (`GET <api>/.well-known/jwks.json`). */
const JwkSchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string(),
  y: z.string(),
  kid: z.string(),
});
const JwksSchema = z.object({ keys: z.array(z.unknown()) });
const HeaderSchema = z.object({ alg: z.literal("ES256"), kid: z.string() });

type Fetch = (url: string) => Promise<Response>;
type Jwk = z.infer<typeof JwkSchema>;

/** The production key set. */
export const OGS_JWKS_URL = "https://api.opengame.org/.well-known/jwks.json";
const REFETCH_MS = 60_000;

export interface VerifierOptions {
  jwksUrl?: string;
  fetch?: Fetch;
  now?: () => number;
}

/**
 * A verifier with its own cached key set: checks the ES256 signature against OGS's JWKS, that the
 * token is for `appId` (a token for another game is rejected) and not expired. Null when any fails.
 */
export function createOgsVerifier(opts: VerifierOptions = {}) {
  const jwksUrl = opts.jwksUrl ?? OGS_JWKS_URL;
  const doFetch: Fetch = opts.fetch ?? ((url) => fetch(url));
  const now = opts.now ?? Date.now;
  let keys: Map<string, Jwk> | null = null;
  let missFetchedAt = Number.NEGATIVE_INFINITY;

  const loadKeys = async (): Promise<void> => {
    const res = await doFetch(jwksUrl);
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const set = JwksSchema.parse(await res.json());
    const next = new Map<string, Jwk>();
    for (const k of set.keys) {
      const jwk = JwkSchema.safeParse(k);
      if (jwk.success) next.set(jwk.data.kid, jwk.data);
    }
    keys = next;
  };

  /** The key for `kid`: the cached set, loaded once; an unknown kid refetches at most once a minute. */
  const keyFor = async (kid: string): Promise<Jwk | undefined> => {
    try {
      if (!keys) await loadKeys();
      else if (!keys.has(kid) && now() - missFetchedAt >= REFETCH_MS) {
        missFetchedAt = now();
        await loadKeys();
      }
    } catch {
      return undefined;
    }
    return keys?.get(kid);
  };

  return async function verify(token: string, appId: string): Promise<GameToken | null> {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = HeaderSchema.safeParse(jsonPart(parts[0]));
    if (!header.success) return null;
    const jwk = await keyFor(header.data.kid);
    if (!jwk) return null;
    if (!(await signatureOk(jwk, parts))) return null;
    const claims = GameTokenSchema.safeParse(jsonPart(parts[1]));
    if (!claims.success) return null;
    if (claims.data.aud !== appId) return null;
    return claims.data.exp * 1000 > now() ? claims.data : null;
  };
}

async function signatureOk(jwk: Jwk, [h, p, s]: string[]): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
  } catch {
    return false;
  }
}

const verifiers = new Map<string, ReturnType<typeof createOgsVerifier>>();

/**
 * Verifies an OGS game token for this game: `verifyOgsToken(token, { appId: "rocket-crew" })`.
 * The key set is cached per `jwksUrl` (default: production OGS); passing `fetch` or `now` uses a
 * fresh verifier (tests).
 */
export function verifyOgsToken(
  token: string,
  opts: { appId: string } & VerifierOptions,
): Promise<GameToken | null> {
  const jwksUrl = opts.jwksUrl ?? OGS_JWKS_URL;
  if (opts.fetch || opts.now) return createOgsVerifier({ ...opts, jwksUrl })(token, opts.appId);
  let verifier = verifiers.get(jwksUrl);
  if (!verifier) {
    verifier = createOgsVerifier({ jwksUrl });
    verifiers.set(jwksUrl, verifier);
  }
  return verifier(token, opts.appId);
}
