import appJson from "../../app.json";

/**
 * Game links open the app (docs/acceptance/2026-10-07-game-links.feature): the invite and transfer
 * link opengame.org/play/<appId> must be claimed on both platforms. A native build ships these.
 */
// The mobile tsconfig has no Node types; jest runs from apps/mobile.
const fs = jest.requireActual<{ readFileSync(path: string, encoding: "utf8"): string }>("fs");
const app = appJson.expo;
const aasa = JSON.parse(
  fs.readFileSync("../web/public/.well-known/apple-app-site-association", "utf8"),
);

describe("app link config", () => {
  it("iOS: the app claims opengame.org and triviajam.tv", () => {
    expect(app.ios.associatedDomains).toEqual(
      expect.arrayContaining(["applinks:opengame.org", "applinks:triviajam.tv"]),
    );
  });

  it("iOS: opengame.org hands the app /play/* and /open", () => {
    expect(aasa.applinks.details).toEqual([
      {
        appID: `${app.ios.appleTeamId}.${app.ios.bundleIdentifier}`,
        paths: ["/open", "/open/*", "/play/*"],
      },
    ]);
  });

  it("Android: the app verifies opengame.org /open and /play/", () => {
    const hosts = app.android.intentFilters.flatMap((f) =>
      f.data.map((d) => `${d.host}${d.pathPrefix}`),
    );
    expect(hosts).toEqual(["opengame.org/open", "opengame.org/play/"]);
    expect(app.android.intentFilters.every((f) => f.autoVerify)).toBe(true);
  });
});
