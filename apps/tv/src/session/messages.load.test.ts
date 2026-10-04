import { describe, expect, it } from "vitest";

// Imported inside the test, not at the top: a schema that cannot be built throws while the module
// loads, and that must fail a test rather than silently skip the whole file.
describe("server message schema", () => {
  it("builds, and tells each message apart by its type", async () => {
    const { parseServerMessage } = await import("./messages");
    expect(parseServerMessage('{"type":"focus.move","dir":"up"}')).toEqual({
      type: "focus.move",
      dir: "up",
    });
    expect(parseServerMessage('{"type":"error"}')).toEqual({ type: "error" });
  });
});
