import { safeCrop } from "../art-crop";

describe("safeCrop (manifest art.safe on the phone)", () => {
  it("has no transform without a safe crop", () => {
    expect(safeCrop(undefined)).toBeUndefined();
  });
  it("zooms past the game's HUD from the declared origin", () => {
    expect(safeCrop({ scale: 1.17, ox: 50, oy: 100 })).toEqual({
      transform: [{ scale: 1.17 }],
      transformOrigin: "50% 100%",
    });
  });
});
