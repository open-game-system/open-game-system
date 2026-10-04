// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getOgsProfileSource, getOgsSessionSource, reportOgsSitting } from "./index";

/** Rendering on the server (no window): nobody is playing and nothing is reported. */
describe("profile-kit without a window", () => {
  it("has no profile and no couch session, and its sources can be subscribed", () => {
    for (const source of [getOgsProfileSource(), getOgsSessionSource()]) {
      expect(source.getSnapshot()).toBeNull();
      const off = source.subscribe(() => {});
      expect(typeof off).toBe("function");
      expect(() => off()).not.toThrow();
    }
  });

  it("creates nothing: both sources are the same inert one", () => {
    expect(getOgsProfileSource()).toBe(getOgsSessionSource());
  });

  it("reports nowhere", () => {
    expect(
      reportOgsSitting({ instanceId: "rocket-crew:PQWS", appId: "rocket-crew", status: "active" }),
    ).toBe("none");
  });
});
