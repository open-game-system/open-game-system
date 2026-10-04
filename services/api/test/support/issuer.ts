/**
 * A fake OpenID issuer for Node tests: RS256-signs ID tokens and answers its discovery document
 * and JWKS. Pair `handles` with a fetch stub.
 */
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const encodeJson = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

const RSA = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

export interface FakeIssuer {
  /** Signs `claims` (iss defaults to the issuer, exp to an hour from now). */
  idToken(claims: Record<string, unknown>): Promise<string>;
  /** Discovery + JWKS responses, or null for other URLs. */
  handles(url: string): Response | null;
}

export async function fakeIssuer(issuer: string): Promise<FakeIssuer> {
  const pair = await crypto.subtle.generateKey(RSA, true, ["sign", "verify"]);
  if (!("privateKey" in pair)) throw new Error("expected a key pair");
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  if (jwk instanceof ArrayBuffer) throw new Error("expected a JWK");
  const base = issuer.replace(/\/+$/, "");
  return {
    async idToken(claims) {
      const head = encodeJson({ alg: "RS256", kid: "k1" });
      const body = encodeJson({ iss: base, exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
      const sig = await crypto.subtle.sign(
        RSA,
        pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`),
      );
      return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
    },
    handles(url) {
      if (url === `${base}/.well-known/openid-configuration`) {
        return Response.json({ issuer: base, jwks_uri: `${base}/jwks` });
      }
      if (url === `${base}/jwks`) return Response.json({ keys: [{ ...jwk, kid: "k1" }] });
      return null;
    },
  };
}
