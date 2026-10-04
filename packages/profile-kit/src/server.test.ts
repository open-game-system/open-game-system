// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOgsVerifier, verifyOgsToken } from "./server";
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
const JWKS_URL = "https://api.opengame.test/.well-known/jwks.json";

async function setup() {
  const key = await testKey("k1");
  const fetch = vi.fn(async (_url: string) => Response.json({ keys: [key.publicJwk] }));
  const verify = createOgsVerifier({ jwksUrl: JWKS_URL, fetch, now: () => NOW });
  return { key, fetch, verify };
}

describe("verifying an OGS game token on the game's server", () => {
  it("accepts a token OGS signed for this game", async () => {
    const { key, verify, fetch } = await setup();
    expect(await verify(await key.sign(claims), "rocket-crew")).toEqual(claims);
    expect(fetch).toHaveBeenCalledWith(JWKS_URL);
  });

  it("rejects game A's token in game B", async () => {
    const { key, verify } = await setup();
    const storyNook = await key.sign({ ...claims, aud: "story-nook" });
    expect(await verify(storyNook, "rocket-crew")).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { key, verify } = await setup();
    expect(await verify(await key.sign({ ...claims, exp: NOW / 1000 }), "rocket-crew")).toBeNull();
    expect(
      await verify(await key.sign({ ...claims, exp: NOW / 1000 + 1 }), "rocket-crew"),
    ).not.toBeNull();
  });

  it("rejects a token signed by another key with the same kid", async () => {
    const { verify } = await setup();
    const impostor = await testKey("k1");
    expect(await verify(await impostor.sign(claims), "rocket-crew")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const { key, verify } = await setup();
    const [h, , s] = (await key.sign(claims)).split(".");
    const forged = btoa(JSON.stringify({ ...claims, name: "Mallory" }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(await verify(`${h}.${forged}.${s}`, "rocket-crew")).toBeNull();
  });

  it.each([
    { alg: "HS256", kid: "k1" },
    { alg: "none", kid: "k1" },
    { alg: "ES256" },
  ])("rejects a header %j", async (header) => {
    const { key, verify } = await setup();
    expect(await verify(await key.sign(claims, header), "rocket-crew")).toBeNull();
  });

  it.each(["", "a.b", "a.b.c", "x.y.z.w"])("rejects garbage %j", async (t) => {
    const { verify } = await setup();
    expect(await verify(t, "rocket-crew")).toBeNull();
  });

  it("rejects claims that aren't a game token", async () => {
    const { key, verify } = await setup();
    const { name: _n, ...noName } = claims;
    expect(await verify(await key.sign(noName), "rocket-crew")).toBeNull();
  });

  it("caches the key set, and refetches it for a new kid (key rotation)", async () => {
    const { key, verify, fetch } = await setup();
    await verify(await key.sign(claims), "rocket-crew");
    await verify(await key.sign(claims), "rocket-crew");
    expect(fetch).toHaveBeenCalledTimes(1);
    const rotated = await testKey("k2");
    fetch.mockImplementation(async () =>
      Response.json({ keys: [key.publicJwk, rotated.publicJwk] }),
    );
    expect(await verify(await rotated.sign(claims), "rocket-crew")).toEqual(claims);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("an unknown kid does not refetch more than once a minute", async () => {
    const { verify, fetch } = await setup();
    const stranger = await testKey("zz");
    await verify(await stranger.sign(claims), "rocket-crew");
    await verify(await stranger.sign(claims), "rocket-crew");
    await verify(await stranger.sign(claims), "rocket-crew");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("a key set that can't be fetched rejects (and is tried again next time)", async () => {
    const { key, verify, fetch } = await setup();
    fetch.mockImplementationOnce(async () => new Response("down", { status: 503 }));
    expect(await verify(await key.sign(claims), "rocket-crew")).toBeNull();
    expect(await verify(await key.sign(claims), "rocket-crew")).toEqual(claims);
  });

  it("a malformed key set rejects", async () => {
    const { key, verify, fetch } = await setup();
    fetch.mockImplementation(async () => Response.json({ keys: "nope" }));
    expect(await verify(await key.sign(claims), "rocket-crew")).toBeNull();
  });

  it("verifyOgsToken: one call with appId and jwksUrl", async () => {
    const key = await testKey("k9");
    const fetch = vi.fn(async () => Response.json({ keys: [key.publicJwk] }));
    const token = await key.sign({ ...claims, exp: Math.floor(Date.now() / 1000) + 60 });
    const ok = await verifyOgsToken(token, { appId: "rocket-crew", jwksUrl: JWKS_URL, fetch });
    expect(ok?.sub).toBe("p_juneau");
    expect(
      await verifyOgsToken(token, { appId: "story-nook", jwksUrl: JWKS_URL, fetch }),
    ).toBeNull();
  });
});
