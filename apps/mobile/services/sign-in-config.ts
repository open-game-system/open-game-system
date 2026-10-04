/**
 * Where "Continue with Google" signs in. Real Google by default; e2e points it at the
 * vercel-labs/emulate Google emulator with EXPO_PUBLIC_GOOGLE_ISSUER. Apple is native
 * (expo-apple-authentication) and has nothing to configure here.
 */

export interface GoogleConfig {
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
}

type Env = Record<string, string | undefined>;

const GOOGLE = "https://accounts.google.com";
const GOOGLE_CLIENT_SUFFIX = ".apps.googleusercontent.com";

/** Google iOS clients redirect to their reversed client id; anything else to the app's scheme. */
function defaultRedirect(clientId: string): string {
  if (clientId.endsWith(GOOGLE_CLIENT_SUFFIX)) {
    const id = clientId.slice(0, -GOOGLE_CLIENT_SUFFIX.length);
    return `com.googleusercontent.apps.${id}:/oauthredirect`;
  }
  return "opengame:/oauthredirect";
}

export function readSignInConfig(env: Env): { google: GoogleConfig } {
  const issuer = (env.EXPO_PUBLIC_GOOGLE_ISSUER || GOOGLE).replace(/\/+$/, "");
  const clientId = env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
  return {
    google: {
      clientId,
      authorizeUrl: `${issuer}/o/oauth2/v2/auth`,
      tokenUrl:
        issuer === GOOGLE ? "https://oauth2.googleapis.com/token" : `${issuer}/oauth2/token`,
      redirectUri: env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || defaultRedirect(clientId),
    },
  };
}

export function googleAuthUrl(
  google: GoogleConfig,
  p: { state: string; codeChallenge: string; nonce: string },
): string {
  const q = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: google.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${google.authorizeUrl}?${q.toString()}`;
}

/** Metro inlines EXPO_PUBLIC_* only for literal reads, so each is listed. */
export const signInConfig = readSignInConfig({
  EXPO_PUBLIC_GOOGLE_ISSUER: process.env.EXPO_PUBLIC_GOOGLE_ISSUER,
  EXPO_PUBLIC_GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_REDIRECT_URI: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI,
});
