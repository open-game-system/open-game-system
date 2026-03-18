import { describe, expect, it } from "vitest";
import { StreamCanvas, StreamProvider } from "./index";

describe("stream-kit-react", () => {
  it("should export expected components and context", () => {
    expect(typeof StreamProvider).toBe("object");
    expect(typeof StreamCanvas).toBe("object");
  });
});
