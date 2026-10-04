import { isLauncherView, launcherUrl, readConfig } from "../config";

describe("app config from EXPO_PUBLIC_* env", () => {
  it("defaults to the local dev servers and real Google Cast", () => {
    expect(readConfig({})).toEqual({
      apiBase: "http://localhost:8787",
      tvBase: "http://localhost:5180",
      fakeCast: "off",
      fakeCastUrl: "http://localhost:5181/load",
    });
  });

  it("reads every override and trims trailing slashes", () => {
    expect(
      readConfig({
        EXPO_PUBLIC_OGS_API: "https://api.example/",
        EXPO_PUBLIC_OGS_TV: "https://tv.example/",
        EXPO_PUBLIC_FAKE_CAST: "1",
        EXPO_PUBLIC_FAKE_CAST_URL: "http://10.0.0.2:5181/load",
      }),
    ).toEqual({
      apiBase: "https://api.example",
      tvBase: "https://tv.example",
      fakeCast: "one",
      fakeCastUrl: "http://10.0.0.2:5181/load",
    });
  });

  it("EXPO_PUBLIC_FAKE_CAST=none simulates a house with no TV", () => {
    expect(readConfig({ EXPO_PUBLIC_FAKE_CAST: "none" }).fakeCast).toBe("none");
  });

  it("EXPO_PUBLIC_FAKE_CAST=2 simulates a house with two TVs", () => {
    expect(readConfig({ EXPO_PUBLIC_FAKE_CAST: "2" }).fakeCast).toBe("two");
  });

  it("any other EXPO_PUBLIC_FAKE_CAST value keeps real Google Cast", () => {
    expect(readConfig({ EXPO_PUBLIC_FAKE_CAST: "0" }).fakeCast).toBe("off");
  });
});

describe("the launcher URL the receiver loads once per evening", () => {
  it("points the TV at the launcher with the API and a launcher token", () => {
    const url = launcherUrl(readConfig({}), "tok en/1");
    expect(url).toBe("http://localhost:5180/?api=http%3A%2F%2Flocalhost%3A8787&token=tok%20en%2F1");
  });
});

describe("is the receiver showing the launcher?", () => {
  const config = readConfig({});
  it("yes for the launcher URL", () => {
    expect(isLauncherView(config, launcherUrl(config, "t"))).toBe(true);
  });
  it("no for a game's own TV page or nothing", () => {
    expect(isLauncherView(config, "https://rocket-crew.example/tv/AB")).toBe(false);
    expect(isLauncherView(config, null)).toBe(false);
  });
});

describe("config URLs", () => {
  it("trims every trailing slash", () => {
    const c = readConfig({ EXPO_PUBLIC_OGS_API: "https://api.example//" });
    expect(c.apiBase).toBe("https://api.example");
  });
});
