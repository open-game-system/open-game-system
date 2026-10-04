import { describe, expect, it } from "vitest";
import { CODE_TTL_MS, checkCode, codeEmail, hashCode, MAX_ATTEMPTS, newEmailCode } from "../src/lib/email-code";

describe("email sign-in codes", () => {
  it("makes 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(newEmailCode()).toMatch(/^\d{6}$/);
  });

  it("hashes per address", async () => {
    const a = await hashCode("a@example.com", "123456");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await hashCode("a@example.com", "123456"));
    expect(a).not.toBe(await hashCode("b@example.com", "123456"));
    expect(a).not.toBe(await hashCode("a@example.com", "123457"));
  });

  const stored = { codeHash: "h", expiresAt: 1_000 + CODE_TTL_MS, attempts: 0 };
  it("accepts the right code before it expires", () => {
    expect(checkCode(stored, "h", 1_000)).toBe("ok");
    expect(checkCode(stored, "h", 1_000 + CODE_TTL_MS - 1)).toBe("ok");
  });
  it("stops working after 10 minutes", () => {
    expect(CODE_TTL_MS).toBe(600_000);
    expect(checkCode(stored, "h", 1_000 + CODE_TTL_MS)).toBe("expired");
  });
  it("a wrong code is wrong", () => {
    expect(checkCode(stored, "x", 1_000)).toBe("wrong");
  });
  it("is burned after 5 wrong tries, even with the right code", () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(checkCode({ ...stored, attempts: 4 }, "h", 1_000)).toBe("ok");
    expect(checkCode({ ...stored, attempts: 5 }, "h", 1_000)).toBe("burned");
  });
  it("the email carries the code and a link with it", () => {
    const m = codeEmail("042133");
    expect(m.subject).toBe("042133 is your OGS code");
    expect(m.text).toContain("Your OGS code is 042133.");
    expect(m.text).toContain("https://opengame.org/signin?code=042133");
    expect(m.html).toContain(">042133<");
  });
});
