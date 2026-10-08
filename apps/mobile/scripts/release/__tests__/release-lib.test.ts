import { needsBuild, parseRecorded, testflightState } from "../release-lib";

/** docs/acceptance/2026-10-07-beta-distribution.feature: CI's build-or-OTA decision. */
describe("needsBuild", () => {
  it("builds when nothing is recorded", () => {
    expect(needsBuild("abc", null)).toBe(true);
  });

  it("ships over the air when the recorded fingerprint matches", () => {
    expect(needsBuild("abc", { build: 12, fingerprint: "abc" })).toBe(false);
  });

  it("builds when the native fingerprint changed", () => {
    expect(needsBuild("def", { build: 12, fingerprint: "abc" })).toBe(true);
  });
});

describe("parseRecorded", () => {
  it("reads the API's release", () => {
    expect(
      parseRecorded(200, {
        platform: "ios",
        build: 12,
        fingerprint: "abc",
        updateUrl: "https://x.test",
        updatedAt: 1,
      }),
    ).toEqual({ build: 12, fingerprint: "abc" });
  });

  it("treats 404 as nothing recorded", () => {
    expect(parseRecorded(404, { error: { code: "not_found" } })).toBeNull();
  });

  it("fails loudly on anything else (never builds or skips by accident)", () => {
    expect(() => parseRecorded(500, {})).toThrow(/500/);
    expect(() => parseRecorded(200, { build: "12" })).toThrow();
  });
});

describe("testflightState", () => {
  const builds = (...states: string[]) => ({
    data: states.map((s) => ({ attributes: { processingState: s } })),
  });

  it("is missing until App Store Connect lists the build", () => {
    expect(testflightState({ data: [] })).toBe("missing");
  });

  it("is processing while Apple processes it", () => {
    expect(testflightState(builds("PROCESSING"))).toBe("processing");
  });

  it("is ready once VALID", () => {
    expect(testflightState(builds("VALID"))).toBe("ready");
  });

  it.each(["FAILED", "INVALID"])("has failed when %s", (s) => {
    expect(testflightState(builds(s))).toBe("failed");
  });

  it("refuses an answer it does not understand", () => {
    expect(() => testflightState({ errors: [{ status: "401" }] })).toThrow();
    expect(() => testflightState(builds("SOMETHING_NEW"))).toThrow();
  });
});
