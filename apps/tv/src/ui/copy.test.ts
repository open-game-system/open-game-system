import { describe, expect, it } from "vitest";
import { roomTitle } from "./copy";

describe("roomTitle", () => {
  it("names the TV and whose games it shows", () => {
    expect(roomTitle("Living room TV", "Jonathan")).toBe("Living room TV · Jonathan's games");
  });
  it("adds an apostrophe after a name ending in s", () => {
    expect(roomTitle("Den", "James")).toBe("Den · James' games");
  });
  it("ignores surrounding spaces", () => {
    expect(roomTitle("  Living room TV ", " Mom ")).toBe("Living room TV · Mom's games");
  });
});
