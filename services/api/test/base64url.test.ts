import { describe, expect, it } from "vitest";
import { base64url } from "../src/lib/base64url";

describe("base64url", () => {
  it("swaps + and / for - and _ everywhere, and drops all padding", () => {
    // 0xfb 0xff 0xbf → "+/+/" in base64
    expect(base64url(new Uint8Array([0xfb, 0xff, 0xbf, 0xfb, 0xff, 0xbf]))).toBe("-_-_-_-_");
    expect(base64url(new Uint8Array([0xff]))).toBe("_w");
    expect(base64url(new Uint8Array([0xff, 0xff]))).toBe("__8");
    expect(base64url(new Uint8Array([]))).toBe("");
  });

  it("never leaves an = in the output", () => {
    for (let n = 0; n < 8; n++) expect(base64url(new Uint8Array(n).fill(0x3e))).not.toContain("=");
  });
});
