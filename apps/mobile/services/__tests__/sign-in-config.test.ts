import { googleAuthUrl, readSignInConfig } from "../sign-in-config";

describe("sign-in providers from EXPO_PUBLIC_* env", () => {
  it("defaults to real Google, with no client id yet", () => {
    expect(readSignInConfig({})).toEqual({
      google: {
        clientId: "",
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        redirectUri: "opengame:/oauthredirect",
      },
    });
  });

  it("an iOS Google client id redirects to its reversed-client-id scheme", () => {
    const { google } = readSignInConfig({
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
    });
    expect(google.redirectUri).toBe("com.googleusercontent.apps.123-abc:/oauthredirect");
  });

  it("an emulated Google issuer serves both endpoints (vercel-labs/emulate)", () => {
    const { google } = readSignInConfig({
      EXPO_PUBLIC_GOOGLE_ISSUER: "http://localhost:4102/",
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: "ogs-test.apps.googleusercontent.com",
      EXPO_PUBLIC_GOOGLE_REDIRECT_URI: "opengame://oauthredirect",
    });
    expect(google).toEqual({
      clientId: "ogs-test.apps.googleusercontent.com",
      authorizeUrl: "http://localhost:4102/o/oauth2/v2/auth",
      tokenUrl: "http://localhost:4102/oauth2/token",
      redirectUri: "opengame://oauthredirect",
    });
  });
});

describe("the Google authorize URL (code + PKCE, asking for an ID token)", () => {
  it("carries the client, redirect, scopes, state and S256 challenge", () => {
    const { google } = readSignInConfig({ EXPO_PUBLIC_GOOGLE_CLIENT_ID: "c1" });
    const url = new URL(googleAuthUrl(google, { state: "st", codeChallenge: "ch", nonce: "n1" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "c1",
      redirect_uri: "opengame:/oauthredirect",
      response_type: "code",
      scope: "openid email profile",
      state: "st",
      nonce: "n1",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });
});

describe("the Google issuer", () => {
  it("trims every trailing slash", () => {
    const { google } = readSignInConfig({ EXPO_PUBLIC_GOOGLE_ISSUER: "http://localhost:4102//" });
    expect(google.tokenUrl).toBe("http://localhost:4102/oauth2/token");
  });
});
