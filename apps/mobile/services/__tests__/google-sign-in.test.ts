import { googleIdToken } from "../google-sign-in";
import { readSignInConfig } from "../sign-in-config";

const google = readSignInConfig({
  EXPO_PUBLIC_GOOGLE_ISSUER: "http://localhost:4102",
  EXPO_PUBLIC_GOOGLE_CLIENT_ID: "ogs-test.apps.googleusercontent.com",
  EXPO_PUBLIC_GOOGLE_REDIRECT_URI: "opengame://oauthredirect",
}).google;

function deps(redirect: (authUrl: string) => { type: string; url?: string }) {
  const tokenCalls: { url: string; body: string }[] = [];
  let n = 0;
  return {
    tokenCalls,
    d: {
      openAuthSession: jest.fn(async (url: string, _redirect: string) => redirect(url)),
      fetch: jest.fn(async (url: string, init?: RequestInit) => {
        tokenCalls.push({ url, body: String(init?.body) });
        return new Response(JSON.stringify({ id_token: "google-id-token", access_token: "a" }));
      }),
      random: () => `r${++n}`,
      sha256Base64Url: async (s: string) => `sha(${s})`,
    },
  };
}

const success = (authUrl: string, code = "the-code") => {
  const state = new URL(authUrl).searchParams.get("state");
  return { type: "success", url: `opengame://oauthredirect?code=${code}&state=${state}` };
};

describe("Continue with Google", () => {
  it("opens the authorize page with PKCE, exchanges the code and returns the ID token", async () => {
    const { d, tokenCalls } = deps((u) => success(u));
    expect(await googleIdToken(google, d)).toBe("google-id-token");
    const authUrl = new URL(d.openAuthSession.mock.calls[0]?.[0] ?? "");
    expect(authUrl.searchParams.get("code_challenge")).toBe("sha(r1)");
    expect(d.openAuthSession.mock.calls[0]?.[1]).toBe("opengame://oauthredirect");
    expect(tokenCalls[0]?.url).toBe("http://localhost:4102/oauth2/token");
    expect(Object.fromEntries(new URLSearchParams(tokenCalls[0]?.body))).toEqual({
      grant_type: "authorization_code",
      code: "the-code",
      client_id: "ogs-test.apps.googleusercontent.com",
      redirect_uri: "opengame://oauthredirect",
      code_verifier: "r1",
    });
  });

  it("a closed sheet is a cancel (null)", async () => {
    const { d } = deps(() => ({ type: "cancel" }));
    expect(await googleIdToken(google, d)).toBeNull();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("a redirect with another state is refused", async () => {
    const { d } = deps(() => ({
      type: "success",
      url: "opengame://oauthredirect?code=c&state=forged",
    }));
    await expect(googleIdToken(google, d)).rejects.toThrow(/didn't match/);
  });

  it("an error from Google is shown", async () => {
    const { d } = deps((u) => ({
      type: "success",
      url: `opengame://oauthredirect?error=access_denied&state=${new URL(u).searchParams.get("state")}`,
    }));
    await expect(googleIdToken(google, d)).rejects.toThrow(/access_denied/);
  });

  it("a token answer without an ID token is refused at the boundary", async () => {
    const { d } = deps((u) => success(u));
    d.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "a" })));
    await expect(googleIdToken(google, d)).rejects.toThrow(/ID token/);
  });

  it("is not offered until a client id is configured", async () => {
    const { d } = deps((u) => success(u));
    await expect(googleIdToken({ ...google, clientId: "" }, d)).rejects.toThrow(/isn't set up/);
  });
});
