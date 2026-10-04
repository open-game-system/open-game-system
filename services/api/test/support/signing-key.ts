import { webcrypto } from "node:crypto";

/** A fresh OGS_GAME_SIGNING_KEY (private P-256 JWK with a kid), as the secret's JSON. */
export async function generateSigningKey(kid: string): Promise<string> {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
  return JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d, kid });
}
