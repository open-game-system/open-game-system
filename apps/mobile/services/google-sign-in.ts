import { z } from "zod";
import { type GoogleConfig, googleAuthUrl } from "./sign-in-config";

/**
 * "Continue with Google": authorization code + PKCE in the system auth sheet, then the code is
 * exchanged for Google's ID token, which OGS verifies (POST /auth/google). Native pieces are
 * injected (runtime: expo-web-browser + expo-crypto) so this runs in tests and against the
 * vercel-labs/emulate Google emulator.
 */

export interface GoogleDeps {
  /** Opens the auth sheet; resolves the redirect it ended on, or a cancel. */
  openAuthSession(url: string, redirectUri: string): Promise<{ type: string; url?: string }>;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  /** A fresh random string (PKCE verifier, state, nonce). */
  random(): string;
  sha256Base64Url(input: string): Promise<string>;
}

const TokenSchema = z.object({ id_token: z.string().min(1) });

export async function googleIdToken(
  google: GoogleConfig,
  deps: GoogleDeps,
): Promise<string | null> {
  if (!google.clientId) throw new Error("Google sign-in isn't set up in this build yet.");
  const verifier = deps.random();
  const state = deps.random();
  const nonce = deps.random();
  const codeChallenge = await deps.sha256Base64Url(verifier);
  const result = await deps.openAuthSession(
    googleAuthUrl(google, { state, codeChallenge, nonce }),
    google.redirectUri,
  );
  if (result.type !== "success" || !result.url) return null;
  return exchangeCode(google, deps, codeFrom(result.url, state), verifier);
}

/** The authorization code in Google's redirect; throws on a forged state, an error, or no code. */
function codeFrom(redirectUrl: string, state: string): string {
  const params = new URL(redirectUrl).searchParams;
  if (params.get("state") !== state) throw new Error("Google's answer didn't match this sign-in.");
  const error = params.get("error");
  if (error) throw new Error(`Google sign-in failed: ${error}`);
  const code = params.get("code");
  if (!code) throw new Error("Google sign-in didn't return a code.");
  return code;
}

/** Trades the code (with the PKCE verifier) for Google's ID token. */
async function exchangeCode(
  google: GoogleConfig,
  deps: GoogleDeps,
  code: string,
  verifier: string,
): Promise<string> {
  const res = await deps.fetch(google.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      code_verifier: verifier,
    }).toString(),
  });
  const parsed = TokenSchema.safeParse(await res.json().catch(() => null));
  if (!res.ok || !parsed.success) throw new Error("Google didn't return an ID token.");
  return parsed.data.id_token;
}
