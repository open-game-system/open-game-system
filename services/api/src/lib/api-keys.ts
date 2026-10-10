import { base64url } from "./base64url";

/**
 * Per-game API keys (spec §9): the game server's one credential for OGS. Shown once when issued;
 * OGS keeps only a SHA-256 hash and a short prefix to tell keys apart.
 */
export const API_KEY_PREFIX = "ogsk_";
export const NOTIFICATIONS_SCOPE = "notifications:send";

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const key = `${API_KEY_PREFIX}${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
  return { key, prefix: key.slice(0, 12), hash: await hashApiKey(key) };
}
