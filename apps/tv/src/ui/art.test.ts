import { describe, expect, it } from "vitest";
import { safeStyle } from "./art";

describe("safeStyle", () => {
  it("zooms past the HUD around the declared anchor", () => {
    expect(safeStyle({ scale: 1.17, ox: 50, oy: 100 })).toEqual({
      transform: "scale(1.17)",
      transformOrigin: "50% 100%",
    });
  });
  it("leaves art alone when the manifest declares no crop", () => {
    expect(safeStyle(undefined)).toBeUndefined();
  });
});
