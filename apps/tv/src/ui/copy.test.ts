import { describe, expect, it } from "vitest";
import { roomName } from "./copy";

describe("roomName", () => {
  it("adds an apostrophe after a name ending in s", () => {
    expect(roomName("The Mumms")).toBe("The Mumms' living room");
  });
  it("adds 's after any other name", () => {
    expect(roomName("Our family")).toBe("Our family's living room");
    expect(roomName("The Lee family")).toBe("The Lee family's living room");
  });
  it("ignores surrounding spaces", () => {
    expect(roomName("  The Mumms ")).toBe("The Mumms' living room");
  });
});
