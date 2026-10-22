import { readRuntimeConfig } from "../runtime-config";

const ogsShell = { appId: "settlewood", gameUrl: "https://settlewood.example/host" };

describe("readRuntimeConfig: the Live Activities flag the plugin wrote", () => {
  it("is on when extra.ogsShell.liveActivities is true", () => {
    const config = readRuntimeConfig({
      name: "Settlewood",
      extra: { ogsShell: { ...ogsShell, liveActivities: true } },
    });
    expect(config.liveActivities).toBe(true);
  });

  it("is absent when the plugin wrote none (the flag is off)", () => {
    expect("liveActivities" in readRuntimeConfig({ name: "S", extra: { ogsShell } })).toBe(false);
  });

  it("refuses a flag that isn't a boolean", () => {
    expect(() =>
      readRuntimeConfig({ name: "S", extra: { ogsShell: { ...ogsShell, liveActivities: "yes" } } }),
    ).toThrow(/liveActivities/);
  });
});
