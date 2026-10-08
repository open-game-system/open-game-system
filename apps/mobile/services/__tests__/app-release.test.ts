import { checkRelease, gateFor } from "../app-release";

/** docs/acceptance/2026-10-07-beta-distribution.feature: the forced update. */
const BASE = "http://api.test";
const TESTFLIGHT = "https://testflight.apple.com/join/XYZ";
const release = (build: number) => ({
  platform: "ios",
  build,
  fingerprint: "abc",
  updateUrl: TESTFLIGHT,
  updatedAt: 1,
});

describe("gateFor", () => {
  it("asks an older build to update, with the release's URL", () => {
    expect(gateFor("11", release(12))).toEqual({ kind: "update", url: TESTFLIGHT });
  });

  it("lets the current build play", () => {
    expect(gateFor("12", release(12))).toEqual({ kind: "ok" });
  });

  it("lets a newer build play", () => {
    expect(gateFor("13", release(12))).toEqual({ kind: "ok" });
  });

  it("compares build numbers as numbers, not text", () => {
    expect(gateFor("9", release(10))).toEqual({ kind: "update", url: TESTFLIGHT });
    expect(gateFor("10", release(9))).toEqual({ kind: "ok" });
  });

  it.each([
    null,
    "",
    "dev",
    "1.0.0",
    "12abc",
  ])("never blocks a build without a whole build number (%p)", (installed) => {
    expect(gateFor(installed, release(12))).toEqual({ kind: "ok" });
  });

  it("lets everyone play when no release is known", () => {
    expect(gateFor("1", null)).toEqual({ kind: "ok" });
  });
});

describe("checkRelease", () => {
  function run(
    respond: (url: string) => Response | Promise<Response>,
    opts: { platform?: string; installedBuild?: string | null } = {},
  ) {
    const urls: string[] = [];
    const result = checkRelease({
      apiBase: BASE,
      platform: opts.platform ?? "ios",
      installedBuild: opts.installedBuild === undefined ? "11" : opts.installedBuild,
      fetch: async (url) => {
        urls.push(url);
        return respond(url);
      },
    });
    return { result, urls };
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("reads the platform's release and gates on it", async () => {
    const { result, urls } = run(() => json(release(12)));
    expect(await result).toEqual({ kind: "update", url: TESTFLIGHT });
    expect(urls).toEqual([`${BASE}/api/v1/app-release/ios`]);
  });

  it("asks for android on android", async () => {
    const { result, urls } = run(() => json({ ...release(3), platform: "android" }), {
      platform: "android",
      installedBuild: "3",
    });
    expect(await result).toEqual({ kind: "ok" });
    expect(urls).toEqual([`${BASE}/api/v1/app-release/android`]);
  });

  it("does not ask at all on other platforms or without a build number", async () => {
    const web = run(() => json(release(12)), { platform: "web" });
    expect(await web.result).toEqual({ kind: "ok" });
    expect(web.urls).toEqual([]);
    const dev = run(() => json(release(12)), { installedBuild: null });
    expect(await dev.result).toEqual({ kind: "ok" });
    expect(dev.urls).toEqual([]);
  });

  it.each([
    ["a 404", () => json({ error: { code: "not_found", message: "", status: 404 } }, 404)],
    ["a 500", () => json({ error: { code: "internal", message: "", status: 500 } }, 500)],
    ["an answer that does not parse", () => json({ build: "twelve" })],
    ["a non-https update URL", () => json({ ...release(12), updateUrl: "javascript:alert(1)" })],
    ["not JSON", () => new Response("<html>", { status: 200 })],
    [
      "a network failure",
      () => {
        throw new TypeError("Network request failed");
      },
    ],
  ])("never blocks on %s", async (_name, respond) => {
    const { result } = run(respond);
    expect(await result).toEqual({ kind: "ok" });
  });
});
