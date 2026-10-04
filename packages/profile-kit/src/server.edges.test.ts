// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOgsVerifier, OGS_JWKS_URL, verifyOgsToken } from "./server";
import { testKey } from "./test-keys";

const NOW = 1_900_000_100_000;
const claims = {
  iss: "https://api.opengame.org",
  aud: "rocket-crew",
  sub: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: "https://tv.opengame.org/art/story-nook/char-dragon.webp",
  iat: 1_900_000_000,
  exp: 1_900_003_600,
};
const fresh = () => ({ ...claims, exp: Math.floor(Date.now() / 1000) + 60 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("game token verification, edges", () => {
  it("fetches production OGS's key set by default", async () => {
    expect(OGS_JWKS_URL).toBe("https://api.opengame.org/.well-known/jwks.json");
    const key = await testKey("k-default");
    const fetch = vi.fn(async (_url: string) => Response.json({ keys: [key.publicJwk] }));
    await verifyOgsToken(await key.sign(fresh()), { appId: "rocket-crew", fetch });
    expect(fetch).toHaveBeenCalledWith(OGS_JWKS_URL);
  });

  it("uses the global fetch when none is given", async () => {
    const key = await testKey("k-global");
    const fetch = vi.fn(async (_url: string) => Response.json({ keys: [key.publicJwk] }));
    vi.stubGlobal("fetch", fetch);
    const verify = createOgsVerifier({ jwksUrl: "https://keys.test/a", now: () => NOW });
    expect(await verify(await key.sign(claims), "rocket-crew")).toEqual(claims);
    expect(fetch).toHaveBeenCalledWith("https://keys.test/a");
  });

  it("does not trust a key set served with an error status", async () => {
    const key = await testKey("k1");
    const fetch = async () => Response.json({ keys: [key.publicJwk] }, { status: 503 });
    const verify = createOgsVerifier({ jwksUrl: "https://keys.test/b", fetch, now: () => NOW });
    expect(await verify(await key.sign(claims), "rocket-crew")).toBeNull();
  });

  it("skips a malformed key and still uses the good ones", async () => {
    const key = await testKey("k1");
    const fetch = async () => Response.json({ keys: [{ kty: "RSA", kid: "old" }, key.publicJwk] });
    const verify = createOgsVerifier({ jwksUrl: "https://keys.test/c", fetch, now: () => NOW });
    expect(await verify(await key.sign(claims), "rocket-crew")).toEqual(claims);
  });

  it("refetches for an unknown kid again exactly a minute later", async () => {
    let t = NOW;
    const key = await testKey("k1");
    const stranger = await testKey("zz");
    const fetch = vi.fn(async (_url: string) => Response.json({ keys: [key.publicJwk] }));
    const verify = createOgsVerifier({ jwksUrl: "https://keys.test/d", fetch, now: () => t });
    const token = await stranger.sign(claims);
    await verify(token, "rocket-crew");
    await verify(token, "rocket-crew");
    expect(fetch).toHaveBeenCalledTimes(2);
    t += 60_000;
    await verify(token, "rocket-crew");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects a valid token with an extra segment", async () => {
    const key = await testKey("k1");
    const fetch = async () => Response.json({ keys: [key.publicJwk] });
    const verify = createOgsVerifier({ jwksUrl: "https://keys.test/e", fetch, now: () => NOW });
    expect(await verify(`${await key.sign(claims)}.extra`, "rocket-crew")).toBeNull();
  });

  it("rejects a token whose published key can't be imported", async () => {
    const key = await testKey("k1");
    const broken = { ...key.publicJwk, x: "not-a-point", y: "nope" };
    const fetch = async () => Response.json({ keys: [broken] });
    const verify = createOgsVerifier({ jwksUrl: "https://keys.test/f", fetch, now: () => NOW });
    expect(await verify(await key.sign(claims), "rocket-crew")).toBeNull();
  });

  it("verifyOgsToken caches one verifier (and its keys) per key set URL", async () => {
    const key = await testKey("k-cache");
    const fetch = vi.fn(async (_url: string) => Response.json({ keys: [key.publicJwk] }));
    vi.stubGlobal("fetch", fetch);
    const token = await key.sign(fresh());
    const jwksUrl = "https://keys.test/cached";
    expect(await verifyOgsToken(token, { appId: "rocket-crew", jwksUrl })).not.toBeNull();
    expect(await verifyOgsToken(token, { appId: "rocket-crew", jwksUrl })).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(jwksUrl);
  });
});
