import { describe, expect, it } from "vitest";
import { ClaimsSchema } from "./token";

const claims = () => ({ hid: "hh-mumm", did: "ipad-juneau", kind: "tablet", exp: 1_900_000_000 });

describe("device token claims", () => {
  it("accepts claims with a paired person", () => {
    const c = { ...claims(), pid: "juneau" };
    expect(ClaimsSchema.parse(c)).toEqual(c);
  });

  it("accepts claims for an unpaired device", () => {
    expect(ClaimsSchema.parse(claims())).toEqual(claims());
  });

  it.each(["hid", "did", "kind", "exp"])("claims without %s are rejected", (key) => {
    const rest = Object.fromEntries(Object.entries(claims()).filter(([k]) => k !== key));
    expect(ClaimsSchema.safeParse(rest).success).toBe(false);
  });

  it.each(["hid", "did", "pid"])("an empty %s is rejected", (key) => {
    expect(ClaimsSchema.safeParse({ ...claims(), [key]: "" }).success).toBe(false);
  });

  it.each(["phone", "tablet", "launcher"])("a token can be for a %s", (kind) => {
    expect(ClaimsSchema.parse({ ...claims(), kind }).kind).toBe(kind);
  });

  it("a launcher token can't claim kind 'admin'", () => {
    expect(ClaimsSchema.safeParse({ ...claims(), kind: "admin" }).success).toBe(false);
  });

  it.each([0, -1, 1.5])("an expiry of %s is rejected", (exp) => {
    expect(ClaimsSchema.safeParse({ ...claims(), exp }).success).toBe(false);
  });
});
