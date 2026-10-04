/** Test helpers: an ES256 key pair and a signer shaped like the OGS API's (tests only). */
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

export async function testKey(kid: string) {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const publicJwk = {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
    kid,
    alg: "ES256",
    use: "sig",
  };
  return {
    kid,
    publicJwk,
    async sign(
      claims: unknown,
      header: Record<string, unknown> = { alg: "ES256", kid, typ: "JWT" },
    ) {
      const input = `${b64urlJson(header)}.${b64urlJson(claims)}`;
      const sig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        pair.privateKey,
        new TextEncoder().encode(input),
      );
      return `${input}.${b64url(new Uint8Array(sig))}`;
    },
  };
}
