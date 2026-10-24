import { readRuntimeConfig } from "../runtime-config";

// docs/acceptance/2026-10-23-airplay-display.feature: the runtime reads what the plugin wrote.
const expo = (ogsShell: Record<string, unknown>) => ({
  name: "Settlewood",
  extra: {
    ogsShell: { appId: "settlewood", gameUrl: "https://settlewood.example/play", ...ogsShell },
  },
});

describe("readRuntimeConfig: airplay", () => {
  it("is on when the plugin wrote airplay: true", () => {
    expect(readRuntimeConfig(expo({ airplay: true })).airplay).toBe(true);
  });

  it("is absent otherwise", () => {
    expect(readRuntimeConfig(expo({}))).not.toHaveProperty("airplay");
    expect(readRuntimeConfig(expo({ airplay: false }))).not.toHaveProperty("airplay");
  });
});
