import { describe, expect, it } from "vitest";

/**
 * The catalogue is product content (names, taglines, roles, art, shop facts): pinned whole, so a
 * change to it is a deliberate snapshot update. Imported inside the test: a manifest that no longer
 * parses throws while the module loads, and that must fail a test rather than skip the file.
 */
describe("catalogue content", () => {
  it("is exactly the games as published", async () => {
    const { CATALOGUE } = await import("../src/catalogue");
    expect(CATALOGUE).toMatchSnapshot();
  });
});
