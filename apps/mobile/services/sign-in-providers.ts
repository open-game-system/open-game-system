import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { googleIdToken } from "./google-sign-in";
import { signInConfig } from "./sign-in-config";

/**
 * The native halves of "Continue with Apple / Google": each resolves the provider's ID token for
 * OGS to verify, or null when the person closes the sheet.
 */

const base64Url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const isCancel = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && err.code === "ERR_REQUEST_CANCELED";

/** Sign in with Apple exists on iOS 13+ only (not on Android or the web). */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function appleIdToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
    });
    return credential.identityToken;
  } catch (err) {
    if (isCancel(err)) return null;
    throw err;
  }
}

export function googleSignIn(): Promise<string | null> {
  return googleIdToken(signInConfig.google, {
    // Ephemeral: no shared Safari cookies and no "wants to use … to sign in" prompt.
    openAuthSession: (url, redirectUri) =>
      WebBrowser.openAuthSessionAsync(url, redirectUri, { preferEphemeralSession: true }),
    fetch: (url, init) => fetch(url, init),
    random: () => Crypto.randomUUID().replace(/-/g, ""),
    sha256Base64Url: async (input) =>
      base64Url(
        await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
          encoding: Crypto.CryptoEncoding.BASE64,
        }),
      ),
  });
}

export const providers = { apple: appleIdToken, google: googleSignIn };
