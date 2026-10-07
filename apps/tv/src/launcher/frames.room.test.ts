import type { CurrentGame } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { startMessage, toSessionMessages } from "./frames";

/** Several couches, one room (spec §7): the launcher's half. */
const cur = (over: Partial<CurrentGame> = {}): CurrentGame => ({
  appId: "night-flight",
  instanceId: "nf-1",
  mode: "new",
  roster: [],
  label: "",
  startedAt: 1,
  viewUrl: null,
  hostDeviceId: "p1",
  ...over,
});

describe("rooms on the launcher", () => {
  it("ogs:start names the room this couch joins", () => {
    expect(startMessage(cur({ room: "KQTP" }), { token: "t", players: [] })).toEqual({
      type: "ogs:start",
      instanceId: "nf-1",
      mode: "new",
      roster: [],
      token: "t",
      players: [],
      room: "KQTP",
    });
    expect(startMessage(cur({ room: "KQTP" }))).toMatchObject({ room: "KQTP" });
  });

  it("a sitting with no room sends no room", () => {
    expect(startMessage(cur(), { token: "t", players: [] })).not.toHaveProperty("room");
  });

  it("the game's ogs:room goes to the couch session as game.room", () => {
    expect(toSessionMessages({ type: "ogs:room", room: "KQTP" }, "night-flight")).toEqual([
      { type: "game.room", appId: "night-flight", room: "KQTP" },
    ]);
  });
});
