import { describe, expect, it } from "vitest";
import { boxFrame, visibleRect } from "./cutover";

describe("reading a frame back", () => {
  it("reads a frame it can't parse as an unknown rect instead of throwing", () => {
    const r = visibleRect({ transform: "none", clipPath: "none" });
    expect([r.x, r.y, r.w, r.h].every(Number.isNaN)).toBe(true);
  });
});

describe("the cut-over frame on a box", () => {
  it("covers a 16:9 box exactly with no clipping", () => {
    const f = boxFrame({ x: 100, y: 200, w: 480, h: 270 });
    expect(f.transform).toBe("translate(100px, 200px) scale(0.25)");
    expect(f.clipPath).toBe("inset(0px 0px round 112px)");
  });

  it("keeps the art's proportions on a square icon: scaled to its height, clipped to its width", () => {
    const f = boxFrame({ x: 96, y: 150, w: 180, h: 180 });
    expect(visibleRect(f)).toEqual({ x: 96, y: 150, w: 180, h: 180 });
    expect(f.transform).toContain("scale(0.16666");
  });

  it("reads the visible rect back from a frame (what the e2e compares to the icon)", () => {
    expect(visibleRect(boxFrame({ x: 10, y: 20, w: 300, h: 100 }))).toEqual({
      x: 10,
      y: 20,
      w: 300,
      h: 100,
    });
  });
});
