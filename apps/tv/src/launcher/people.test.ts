import { initialSession } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { FIXTURE_HOUSEHOLD } from "../session/fixture";
import { nameForDevice, phoneOf } from "./people";

const state = {
  ...initialSession("mumms"),
  devices: [
    { deviceId: "jp", kind: "phone" as const, personId: "jonathan", online: true },
    { deviceId: "tv", kind: "launcher" as const, online: true },
  ],
};

describe("people", () => {
  it("names the person holding a device", () => {
    expect(nameForDevice(state, FIXTURE_HOUSEHOLD, "jp")).toBe("Jonathan");
    expect(nameForDevice(state, FIXTURE_HOUSEHOLD, "tv")).toBeNull();
    expect(nameForDevice(state, FIXTURE_HOUSEHOLD, null)).toBeNull();
  });

  it("says whose phone, or a phone", () => {
    expect(phoneOf(state, FIXTURE_HOUSEHOLD, "jp")).toBe("Jonathan's phone");
    expect(phoneOf(state, FIXTURE_HOUSEHOLD, "nobody")).toBe("the phone");
  });
});
