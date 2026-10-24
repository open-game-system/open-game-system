import { describe, expect, it } from "vitest";
import { nativeConfigFor } from "../native-config";
import { parseShellConfig, ShellConfigSchema } from "../shell-config";

// docs/acceptance/2026-10-23-airplay-display.feature, "A game's own app turns AirPlay on in its shell config".
const minimal = {
  appId: "settlewood",
  gameUrl: "https://settlewood.example/play",
  name: "Settlewood",
};

describe("cast.airplay in the shell config", () => {
  it("is off unless the app says so (the Chromecast cast is unchanged)", () => {
    const config = ShellConfigSchema.parse(minimal);
    expect(config.cast).toEqual({ receiver: "ogs" });
    expect(nativeConfigFor(config).extra.ogsShell).not.toHaveProperty("airplay");
  });

  it("airplay: true reaches the runtime through extra.ogsShell", () => {
    const config = ShellConfigSchema.parse({
      ...minimal,
      cast: { receiver: "ogs", airplay: true },
    });
    expect(config.cast).toEqual({ receiver: "ogs", airplay: true });
    expect(nativeConfigFor(config).extra.ogsShell.airplay).toBe(true);
  });

  it("airplay: false is the same as leaving it out", () => {
    const config = ShellConfigSchema.parse({
      ...minimal,
      cast: { receiver: "ogs", airplay: false },
    });
    expect(nativeConfigFor(config).extra.ogsShell).not.toHaveProperty("airplay");
  });

  it("must be a boolean", () => {
    expect(() =>
      parseShellConfig({ ...minimal, cast: { receiver: "ogs", airplay: "yes" } }),
    ).toThrow("cast.airplay");
  });
});
