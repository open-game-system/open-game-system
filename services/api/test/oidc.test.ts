import { beforeAll, describe, expect, it } from "vitest";
import { type OidcProvider, verifyIdToken } from "../src/lib/oidc";

const ISSUER = "https://issuer.example";
const JWKS_URI = "https://issuer.example/keys";
const CLIENT = "org.opengame.app";
const NOW = 1_800_000_000_000;
const provider: OidcProvider = { issuer: `${ISSUER}/`, clientIds: [CLIENT] };

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const encodeJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
let publicJwk: JsonWebKey;

const rsa = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

async function keyPair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey(rsa, true, ["sign", "verify"]);
  if (!("privateKey" in pair)) throw new Error("expected a key pair");
  return pair;
}

beforeAll(async () => {
  keys = await keyPair();
  otherKeys = await keyPair();
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  if (jwk instanceof ArrayBuffer) throw new Error("expected a JWK");
  publicJwk = jwk;
});

async function sign(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {},
  key = keys.privateKey,
) {
  const head = encodeJson({ alg: "RS256", kid: "k1", ...header });
  const body = encodeJson(claims);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

const goodClaims = (over: Record<string, unknown> = {}) => ({
  iss: ISSUER,
  sub: "user-1",
  aud: CLIENT,
  exp: NOW / 1000 + 60,
  email: "Juneau@Example.com",
  email_verified: true,
  ...over,
});

/** Serves discovery + JWKS for ISSUER; records the URLs it was asked for. */
function issuerFetch(
  jwks: () => unknown = () => ({
    keys: [
      { ...publicJwk, kid: "k1" },
      { kty: "EC", kid: "x" },
    ],
  }),
) {
  const asked: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    if (url === `${ISSUER}/.well-known/openid-configuration`) {
      return Response.json({ issuer: ISSUER, jwks_uri: JWKS_URI });
    }
    if (url === JWKS_URI) return Response.json(jwks());
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetcher, asked };
}

async function verify(
  token: string,
  opts: { nonce?: string; fetch?: typeof fetch; provider?: OidcProvider } = {},
) {
  return verifyIdToken(token, opts.provider ?? provider, {
    now: NOW,
    nonce: opts.nonce,
    fetch: opts.fetch ?? issuerFetch().fetcher,
  });
}

describe("verifyIdToken", () => {
  it("returns the subject and the lower-cased verified email of a valid token", async () => {
    const { fetcher, asked } = issuerFetch();
    expect(await verify(await sign(goodClaims()), { fetch: fetcher })).toEqual({
      subject: "user-1",
      email: "juneau@example.com",
    });
    expect(asked).toEqual([`${ISSUER}/.well-known/openid-configuration`, JWKS_URI]);
  });

  it("accepts Apple's string 'true' for email_verified", async () => {
    expect(await verify(await sign(goodClaims({ email_verified: "true" })))).toEqual({
      subject: "user-1",
      email: "juneau@example.com",
    });
  });

  it.each([
    ["unverified", { email_verified: false }],
    ["string false", { email_verified: "false" }],
    ["missing verification", { email_verified: undefined }],
    ["no email", { email: undefined }],
  ])("drops the email when it is %s", async (_label, over) => {
    expect(await verify(await sign(goodClaims(over)))).toEqual({ subject: "user-1", email: null });
  });

  it("accepts an issuer alias and an audience list containing our client", async () => {
    const aliased = { ...provider, issuerAliases: ["accounts.example"] };
    const token = await sign(goodClaims({ iss: "accounts.example", aud: ["other", CLIENT] }));
    expect(await verify(token, { provider: aliased })).toEqual({
      subject: "user-1",
      email: "juneau@example.com",
    });
  });

  it("accepts a matching nonce", async () => {
    expect(await verify(await sign(goodClaims({ nonce: "n1" })), { nonce: "n1" })).not.toBeNull();
  });

  it.each([
    ["has two segments", async () => "a.b"],
    ["is not base64 json", async () => "%%%.%%%.%%%"],
    ["is not RS256", () => sign(goodClaims(), { alg: "HS256" })],
    ["has no kid", () => sign(goodClaims(), { kid: undefined })],
    ["has an empty subject", () => sign(goodClaims({ sub: "" }))],
    ["is from another issuer", () => sign(goodClaims({ iss: "https://evil.example" }))],
    ["is for another audience", () => sign(goodClaims({ aud: "someone-else" }))],
    ["is for none of an audience list", () => sign(goodClaims({ aud: ["a", "b"] }))],
    ["expires exactly now", () => sign(goodClaims({ exp: NOW / 1000 }))],
    ["has expired", () => sign(goodClaims({ exp: NOW / 1000 - 1 }))],
    ["names a key the issuer does not publish", () => sign(goodClaims(), { kid: "k2" })],
    ["is signed by another key", () => sign(goodClaims(), {}, otherKeys.privateKey)],
  ])("rejects a token that %s", async (_label, make) => {
    expect(await verify(await make())).toBeNull();
  });

  it("rejects a nonce mismatch, and a missing nonce when one is expected", async () => {
    expect(await verify(await sign(goodClaims({ nonce: "n1" })), { nonce: "n2" })).toBeNull();
    expect(await verify(await sign(goodClaims()), { nonce: "n1" })).toBeNull();
  });

  it("rejects without fetching keys when the claims are already wrong", async () => {
    const { fetcher, asked } = issuerFetch();
    expect(await verify(await sign(goodClaims({ aud: "nope" })), { fetch: fetcher })).toBeNull();
    expect(asked).toEqual([]);
  });

  it("returns null when the issuer's documents are unreachable or malformed", async () => {
    const token = await sign(goodClaims());
    const down = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    expect(await verify(token, { fetch: down })).toBeNull();
    expect(await verify(token, { fetch: issuerFetch(() => ({ nope: true })).fetcher })).toBeNull();
  });
});
