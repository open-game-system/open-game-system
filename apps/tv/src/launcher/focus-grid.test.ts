import { describe, expect, it } from "vitest";
import { type FocusRow, firstFocus, locate, move } from "./focus-grid";

const rows: FocusRow[] = [
  { id: "continue", items: ["game:rocket-crew", "game:bake-shop"] },
  { id: "tonight", items: [] },
  { id: "library", items: ["game:story-nook", "game:peekaboo-garden", "game:night-flight"] },
];

describe("focus grid", () => {
  it("starts on the first item of the first non-empty row", () => {
    expect(firstFocus(rows)).toBe("game:rocket-crew");
    expect(
      firstFocus([
        { id: "a", items: [] },
        { id: "b", items: ["x"] },
      ]),
    ).toBe("x");
    expect(firstFocus([])).toBeNull();
  });

  it("locates an item by row and column", () => {
    expect(locate(rows, "game:peekaboo-garden")).toEqual({ row: 2, col: 1 });
    expect(locate(rows, "game:nope")).toBeNull();
    expect(locate(rows, null)).toBeNull();
  });

  it("moves right and left within a row", () => {
    expect(move(rows, "game:rocket-crew", "right")).toBe("game:bake-shop");
    expect(move(rows, "game:bake-shop", "left")).toBe("game:rocket-crew");
  });

  it("stops at the row's ends instead of wrapping", () => {
    expect(move(rows, "game:bake-shop", "right")).toBe("game:bake-shop");
    expect(move(rows, "game:rocket-crew", "left")).toBe("game:rocket-crew");
  });

  it("moves down skipping empty rows, keeping the column", () => {
    expect(move(rows, "game:bake-shop", "down")).toBe("game:peekaboo-garden");
    expect(move(rows, "game:rocket-crew", "down")).toBe("game:story-nook");
  });

  it("clamps the column to a shorter row", () => {
    expect(move(rows, "game:night-flight", "up")).toBe("game:bake-shop");
  });

  it("stays put at the top and bottom edges", () => {
    expect(move(rows, "game:rocket-crew", "up")).toBe("game:rocket-crew");
    expect(move(rows, "game:story-nook", "down")).toBe("game:story-nook");
  });

  it("recovers an unknown or empty focus to the first item", () => {
    expect(move(rows, null, "right")).toBe("game:rocket-crew");
    expect(move(rows, "game:gone", "down")).toBe("game:rocket-crew");
  });

  it("returns null when there is nothing to focus", () => {
    expect(move([], null, "left")).toBeNull();
  });
});
