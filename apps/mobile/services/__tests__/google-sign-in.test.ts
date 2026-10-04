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

  it("a sheet that ends without a redirect URL, or a non-success with one, is a cancel", async () => {
    const noUrl = deps(() => ({ type: "success" }));
    expect(await googleIdToken(google, noUrl.d)).toBeNull();
    const dismissed = deps((u) => ({ ...success(u), type: "dismiss" }));
    expect(await googleIdToken(google, dismissed.d)).toBeNull();
    expect(dismissed.d.fetch).not.toHaveBeenCalled();
  });

  it("a redirect without a code is refused before any exchange", async () => {
    const { d } = deps((u) => ({
      type: "success",
      url: `opengame://oauthredirect?state=${new URL(u).searchParams.get("state")}`,
    }));
    await expect(googleIdToken(google, d)).rejects.toThrow("Google sign-in didn't return a code.");
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("exchanges the code with a form POST", async () => {
    const { d } = deps((u) => success(u));
    await googleIdToken(google, d);
    expect(d.fetch.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  });

  it("a token answer that isn't JSON is refused", async () => {
    const { d } = deps((u) => success(u));
    d.fetch.mockResolvedValueOnce(new Response("<html>oops</html>"));
    await expect(googleIdToken(google, d)).rejects.toThrow("Google didn't return an ID token.");
  });
});

describe("Continue with Google: more edges", () => {
  it("a success without a redirect URL is a cancel", async () => {
    const { d } = deps(() => ({ type: "success" }));
    expect(await googleIdToken(google, d)).toBeNull();
  });

  it("a redirect without a code is refused", async () => {
    const { d } = deps((u) => ({
      type: "success",
      url: `opengame://oauthredirect?state=${new URL(u).searchParams.get("state")}`,
    }));
    await expect(googleIdToken(google, d)).rejects.toThrow(/didn't return a code/);
  });

  it.each([
    ["is not JSON", new Response("<html>", { status: 200 })],
    [
      "is an HTTP error with a token",
      new Response(JSON.stringify({ id_token: "t" }), { status: 400 }),
    ],
  ])("a token answer that %s is refused", async (_label, response) => {
    const { d } = deps((u) => success(u));
    d.fetch.mockResolvedValueOnce(response);
    await expect(googleIdToken(google, d)).rejects.toThrow(/didn't return an ID token/);
  });
});
