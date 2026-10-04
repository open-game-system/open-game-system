// @vitest-environment node
import { describe, expect, it } from "vitest";
import { testKey } from "./test-keys";
import { readGameToken } from "./token";

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

describe("reading a game token in the page (unverified)", () => {
  it("decodes the claims", async () => {
    const key = await testKey("k1");
    expect(readGameToken(await key.sign(claims))).toEqual(claims);
  });

  it.each(["", "a.b", "a.b.c.d", "x.###.y"])("%j is not a game token", (t) => {
    expect(readGameToken(t)).toBeNull();
  });

  it("a payload that isn't game claims is null", async () => {
    const key = await testKey("k1");
    expect(readGameToken(await key.sign({ sub: "p", did: "d" }))).toBeNull();
  });

  it("decodes non-ASCII names", async () => {
    const key = await testKey("k1");
    expect(readGameToken(await key.sign({ ...claims, name: "Zoë" }))?.name).toBe("Zoë");
  });
});
