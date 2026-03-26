/**
 * Minimal JWT implementation using Web Crypto API.
 * Signs and verifies HMAC-SHA256 JWTs suitable for Cloudflare Workers.
 */

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };
const HEADER = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), ALGORITHM, false, [
    "sign",
    "verify",
  ]);
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${HEADER}.${encodedPayload}`;

  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign(
    ALGORITHM.name,
    key,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${encodedSignature}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;

  const key = await getCryptoKey(secret);

  // Decode signature from base64url
  const sigPadded = signature.replace(/-/g, "+").replace(/_/g, "/");
  const sigBytes = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    ALGORITHM.name,
    key,
    sigBytes,
    new TextEncoder().encode(signingInput),
  );

  if (!valid) return null;

  try {
    return JSON.parse(base64UrlDecode(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
