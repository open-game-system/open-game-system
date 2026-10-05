import { describe, expect, it } from "vitest";
import { ClaimsSchema } from "./token";

const device = () => ({ sub: "juneau", did: "ipad-juneau", kind: "tablet", exp: 1_900_000_000 });
const launcher = () => ({
  sub: "jonathan",
  did: "launcher-1",
  kind: "launcher",
  sid: "s-1",
  exp: 1_900_000_000,
});

describe("profile token claims", () => {
  it("accepts a phone or tablet token for a profile", () => {
    expect(ClaimsSchema.parse(device())).toEqual(device());
    expect(ClaimsSchema.parse({ ...device(), kind: "phone" }).kind).toBe("phone");
  });

  it("accepts a launcher token naming its session (sub is the host)", () => {
    expect(ClaimsSchema.parse(launcher())).toEqual(launcher());
  });

  it("a launcher token without a session is rejected", () => {
    const { sid: _sid, ...rest } = launcher();
    expect(ClaimsSchema.safeParse(rest).success).toBe(false);
  });

  it("says why a launcher token without a session is refused", () => {
    const { sid: _sid, ...rest } = launcher();
    const r = ClaimsSchema.safeParse(rest);
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      "a launcher token names its session; a phone or tablet token doesn't",
    ]);
  });

  it.each(["phone", "tablet"])("a %s token naming a session is rejected", (kind) => {
    expect(ClaimsSchema.safeParse({ ...device(), kind, sid: "s-1" }).success).toBe(false);
  });

  it.each(["sub", "did", "kind", "exp"])("claims without %s are rejected", (key) => {
    const rest = Object.fromEntries(Object.entries(device()).filter(([k]) => k !== key));
    expect(ClaimsSchema.safeParse(rest).success).toBe(false);
  });

  it.each(["sub", "did"])("an empty %s is rejected", (key) => {
    expect(ClaimsSchema.safeParse({ ...device(), [key]: "" }).success).toBe(false);
  });

  it("an empty session id is rejected", () => {
    expect(ClaimsSchema.safeParse({ ...launcher(), sid: "" }).success).toBe(false);
  });

  it("a token can't claim kind 'admin'", () => {
    expect(ClaimsSchema.safeParse({ ...device(), kind: "admin" }).success).toBe(false);
  });

  it("household claims are not profile claims", () => {
    expect(
      ClaimsSchema.safeParse({ hid: "hh", did: "d", kind: "phone", exp: 1_900_000_000 }).success,
    ).toBe(false);
  });

  it.each([0, -1, 1.5])("an expiry of %s is rejected", (exp) => {
    expect(ClaimsSchema.safeParse({ ...device(), exp }).success).toBe(false);
  });
});
