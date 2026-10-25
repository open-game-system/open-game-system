import { describe, expect, it } from "vitest";
import { signalsFrom } from "./probe";

const base = { userAgent: "ua", webgl: null, frame: null };

describe("tier signals from what the browser gave", () => {
  it("reads deviceMemory (GB) and the heap limit (bytes → MB)", () => {
    expect(signalsFrom({ ...base, deviceMemory: 2, heapLimit: 1.5 * 2 ** 30 })).toEqual({
      ...base,
      deviceMemoryGb: 2,
      heapLimitMb: 1536,
    });
  });

  it("leaves out what the browser doesn't have or gave as nonsense", () => {
    expect(signalsFrom({ ...base, deviceMemory: undefined, heapLimit: "x" })).toEqual(base);
    expect(signalsFrom({ ...base, deviceMemory: 0, heapLimit: -1 })).toEqual(base);
  });

  it("carries CAF's 4K answer and an override when given", () => {
    expect(
      signalsFrom({ ...base, deviceMemory: null, heapLimit: null, uhd: false, override: "lite" }),
    ).toEqual({
      ...base,
      cast: { uhd: false },
      override: "lite",
    });
  });
});
