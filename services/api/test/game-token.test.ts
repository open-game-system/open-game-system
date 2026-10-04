import { GameTokenSchema } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import {
  gameClaims,
  parseSigningKey,
  playerOf,
  publicJwks,
  signGameToken,
} from "../src/lib/game-token";
import { generateSigningKey } from "./support/signing-key";

const profile = { id: "p_juneau", handle: "juneau", name: "Juneau", sticker: "dragon" };
const NOW = 1_900_000_000_000;

const b64 = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");
const partJson = (token: string, i: number) => JSON.parse(atob(b64(token.split(".")[i])));

async function verifyWith(jwk: JsonWebKey, token: string) {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const [h, p, s] = token.split(".");
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    Uint8Array.from(atob(b64(s)), (c) => c.charCodeAt(0)),
    new TextEncoder().encode(`${h}.${p}`),
  );
}

describe("game token claims", () => {
  it("a phone token: profile id, @id, name, avatar URL, aud = the game, 1 h", () => {
    const claims = gameClaims({
      iss: "https://api.test",
      appId: "rocket-crew",
      profile,
      avatarBase: "https://tv.test",
      now: NOW,
    });
    expect(claims).toEqual({
      iss: "https://api.test",
      aud: "rocket-crew",
      sub: "p_juneau",
      handle: "juneau",
      name: "Juneau",
      avatar: "https://tv.test/art/story-nook/char-dragon.webp",
      iat: NOW / 1000,
      exp: NOW / 1000 + 3600,
    });
    expect(GameTokenSchema.parse(claims)).toEqual(claims);
  });

  it("a session token adds the session and the players", () => {
    const players = [playerOf(profile, "https://tv.test")];
    const claims = gameClaims({
      iss: "https://api.test",
      appId: "rocket-crew",
      profile,
      avatarBase: "https://tv.test",
      now: NOW + 999,
      session: { sid: "s-1", players },
    });
    expect(claims.sid).toBe("s-1");
    expect(claims.players).toEqual([
      {
        id: "p_juneau",
        handle: "juneau",
        name: "Juneau",
        avatar: "https://tv.test/art/story-nook/char-dragon.webp",
      },
    ]);
    expect(claims.iat).toBe(Math.floor((NOW + 999) / 1000));
  });
});

describe("the signing key", () => {
  it("parses a private P-256 JWK with a kid", async () => {
    const raw = await generateSigningKey("k-test");
    const key = parseSigningKey(raw);
    expect(key?.kid).toBe("k-test");
  });

  it.each([
    undefined,
    "",
    "not json",
    '{"kty":"RSA"}',
    '{"kty":"EC","crv":"P-256","x":"a","y":"b","kid":"k"}',
  ])("refuses %j (missing, not JSON, not an EC private key)", (raw) => {
    expect(parseSigningKey(raw)).toBeNull();
  });

  it("publishes only the public half in the JWKS", async () => {
    const key = parseSigningKey(await generateSigningKey("k-test"));
    if (!key) throw new Error("no key");
    const jwks = publicJwks(key);
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toEqual({
      kty: "EC",
      crv: "P-256",
      x: key.x,
      y: key.y,
      kid: "k-test",
      alg: "ES256",
      use: "sig",
    });
    expect(JSON.stringify(jwks)).not.toContain(key.d);
  });

  it("signs an ES256 JWT that verifies with the published key", async () => {
    const key = parseSigningKey(await generateSigningKey("k-test"));
    if (!key) throw new Error("no key");
    const claims = gameClaims({
      iss: "https://api.test",
      appId: "story-nook",
      profile,
      avatarBase: "https://tv.test",
      now: NOW,
    });
    const token = await signGameToken(claims, key);
    expect(partJson(token, 0)).toEqual({ alg: "ES256", typ: "JWT", kid: "k-test" });
    expect(partJson(token, 1)).toEqual(claims);
    expect(await verifyWith(publicJwks(key).keys[0], token)).toBe(true);
    const other = parseSigningKey(await generateSigningKey("k-other"));
    if (!other) throw new Error("no key");
    expect(await verifyWith(publicJwks(other).keys[0], token)).toBe(false);
  });

  it("signs non-ASCII names", async () => {
    const key = parseSigningKey(await generateSigningKey("k-test"));
    if (!key) throw new Error("no key");
    const claims = gameClaims({
      iss: "https://api.test",
      appId: "story-nook",
      profile: { ...profile, name: "Zoë" },
      avatarBase: "https://tv.test",
      now: NOW,
    });
    const token = await signGameToken(claims, key);
    const payload = new TextDecoder().decode(
      Uint8Array.from(atob(b64(token.split(".")[1])), (c) => c.charCodeAt(0)),
    );
    expect(JSON.parse(payload).name).toBe("Zoë");
  });
});
