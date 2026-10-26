import { describe, expect, it } from "vitest";
import { phoneHost } from "./phone-host";

const ua = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15";

describe("phoneHost", () => {
  it("is a browser without the app bridge, whatever the user agent", () => {
    expect(phoneHost({ bridge: false, userAgent: `${ua} OgsShell/my-game`, appId: "my-game" })).toBe("browser");
  });
  it("is this game's own app when the shell marks the user agent with its appId", () => {
    expect(phoneHost({ bridge: true, userAgent: `${ua} OgsShell/my-game`, appId: "my-game" })).toBe("own-app");
  });
  it("is the OGS app otherwise (another game's shell mark included)", () => {
    expect(phoneHost({ bridge: true, userAgent: ua, appId: "my-game" })).toBe("ogs-app");
    expect(phoneHost({ bridge: true, userAgent: `${ua} OgsShell/my-game-two`, appId: "my-game" })).toBe("ogs-app");
  });
});
