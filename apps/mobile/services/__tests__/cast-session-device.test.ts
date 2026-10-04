import { sessionConnectedEvent } from "../cast-session-device";

const LG = { id: "lg-1", name: "[LG] webOS TV OLED77B4PUA", type: "chromecast" as const };
const CC = { id: "cc-1", name: "Chromecast HD", type: "chromecast" as const };

describe("sessionConnectedEvent", () => {
  it("names the device the session is actually on, not the first one discovered", () => {
    const event = sessionConnectedEvent({ deviceId: "cc-1", friendlyName: "Chromecast HD" }, [
      LG,
      CC,
    ]);
    expect(event).toMatchObject({
      type: "SESSION_CONNECTED",
      deviceId: "cc-1",
      deviceName: "Chromecast HD",
    });
  });

  it("falls back to the only discovered device when the session can't say", () => {
    expect(sessionConnectedEvent(null, [CC])).toMatchObject({
      deviceId: "cc-1",
      deviceName: "Chromecast HD",
    });
  });

  it("doesn't guess between several devices when the session can't say", () => {
    expect(sessionConnectedEvent(null, [LG, CC])).toMatchObject({
      deviceId: "unknown",
      deviceName: "your TV",
    });
  });
});
