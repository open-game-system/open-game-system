import { ClaimsSchema } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { issueToken, readClaims } from "../src/lib/identity";
import { signJwt } from "../src/lib/jwt";

const SECRET = "unit-secret";
const NOW = 1_800_000_000_000;

describe("identity tokens", () => {
  it("issues a token whose claims match ClaimsSchema and expire after the ttl", async () => {
    const token = await issueToken({ hid: "h1", did: "d1", pid: "p1", kind: "phone" }, SECRET, {
      now: NOW,
      ttlSeconds: 60,
    });
    const claims = await readClaims(token, SECRET, NOW);
    expect(ClaimsSchema.parse(claims)).toEqual({
      hid: "h1",
      did: "d1",
      pid: "p1",
      kind: "phone",
      exp: NOW / 1000 + 60,
    });
  });

  it("omits pid when the device has no person", async () => {
    const token = await issueToken({ hid: "h1", did: "l1", kind: "launcher" }, SECRET, {
      now: NOW,
      ttlSeconds: 60,
    });
    const claims = await readClaims(token, SECRET, NOW);
    expect(claims).not.toBeNull();
    expect(claims && "pid" in claims).toBe(false);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await issueToken({ hid: "h1", did: "d1", kind: "phone" }, "other", {
      now: NOW,
      ttlSeconds: 60,
    });
    expect(await readClaims(token, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token (exp is exclusive)", async () => {
    const token = await issueToken({ hid: "h1", did: "d1", kind: "phone" }, SECRET, {
      now: NOW,
      ttlSeconds: 60,
    });
    expect(await readClaims(token, SECRET, NOW + 59_999)).not.toBeNull();
    expect(await readClaims(token, SECRET, NOW + 60_000)).toBeNull();
  });

  it("rejects a signed token whose payload is not household claims", async () => {
    const legacy = await signJwt({ sub: "device-1", iss: "ogs-api" }, SECRET);
    expect(await readClaims(legacy, SECRET, NOW)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await readClaims("not-a-jwt", SECRET, NOW)).toBeNull();
    expect(await readClaims("a.b.c", SECRET, NOW)).toBeNull();
  });
});
