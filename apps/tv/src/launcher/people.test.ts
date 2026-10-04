import { initialSession } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { FIXTURE_MEMBERS } from "../session/fixture";
import { nameForDevice, phoneOf, playersOf } from "./people";

const state = {
  ...initialSession("s1", "jonathan"),
  members: FIXTURE_MEMBERS,
  devices: [
    { deviceId: "jp", kind: "phone" as const, profileId: "jonathan", online: true },
    { deviceId: "gone", kind: "phone" as const, profileId: "stranger", online: true },
    { deviceId: "tv", kind: "launcher" as const, online: true },
  ],
};

describe("people", () => {
  it("names the member holding a device", () => {
    expect(nameForDevice(state, "jp")).toBe("Jonathan");
    expect(nameForDevice(state, "tv")).toBeNull();
    expect(nameForDevice(state, null)).toBeNull();
  });

  it("knows nobody whose profile isn't a member", () => {
    expect(nameForDevice(state, "gone")).toBeNull();
  });

  it("says whose phone, or a phone", () => {
    expect(phoneOf(state, "jp")).toBe("Jonathan's phone");
    expect(phoneOf(state, "nobody")).toBe("the phone");
  });
});

describe("playersOf", () => {
  it("names who played a game last time, from its roster, in couch order", () => {
    const state = {
      ...initialSession("s", "jonathan"),
      members: [
        { profileId: "jonathan", name: "Jonathan", sticker: "bear" },
        { profileId: "juneau", name: "Juneau", sticker: "dragon" },
      ],
      rosters: { "rocket-crew": [{ profileId: "juneau", roleId: "fixer" }] },
    };
    expect(playersOf(state, "rocket-crew").map((m) => m.name)).toEqual(["Juneau"]);
    expect(playersOf(state, "bake-shop")).toEqual([]);
  });
});
