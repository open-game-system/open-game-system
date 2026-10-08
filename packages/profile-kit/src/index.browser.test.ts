import { describe, expect, it } from "vitest";
import {
  getOgsProfileSource,
  getOgsSessionSource,
  onOgsNotification,
  reportOgsSitting,
  requestOgsNotifications,
} from "./index";

/** A plain browser tab (not the OGS app, not framed by the launcher). */
describe("profile-kit in a plain browser", () => {
  it("shares one source of each kind per page", () => {
    expect(getOgsProfileSource()).toBe(getOgsProfileSource());
    expect(getOgsSessionSource()).toBe(getOgsSessionSource());
  });

  it("reports nowhere, without failing", () => {
    expect(
      reportOgsSitting({ instanceId: "rocket-crew:PQWS", appId: "rocket-crew", status: "active" }),
    ).toBe("none");
  });

  it("notifications: not the OGS app, so null; listening is harmless", async () => {
    await expect(requestOgsNotifications()).resolves.toBeNull();
    const off = onOgsNotification(() => {});
    expect(() => off()).not.toThrow();
  });
});
