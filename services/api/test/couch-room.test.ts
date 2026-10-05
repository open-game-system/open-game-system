import { initialSession, type SessionState } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { roomChange } from "../src/lib/presence";

/** What the CouchSession DO writes to session_rooms after a message (spec §7). */
const cast = (): SessionState => ({ ...initialSession("s-1", "jon"), cast: true });
const playing = (room?: string): SessionState => ({
  ...cast(),
  current: {
    appId: "night-flight",
    instanceId: "nf-1",
    mode: "new",
    roster: [],
    label: "",
    startedAt: 1,
    viewUrl: null,
    hostDeviceId: null,
    ...(room ? { room } : {}),
  },
});

describe("roomChange", () => {
  it("a room appears: write it", () => {
    expect(roomChange(playing(), playing("KQTP"))).toEqual({
      room: { appId: "night-flight", room: "KQTP" },
    });
  });
  it("nothing changed: no write", () => {
    expect(roomChange(playing("KQTP"), playing("KQTP"))).toBeNull();
    expect(roomChange(cast(), cast())).toBeNull();
  });
  it("Home or a game without a room: clear it", () => {
    expect(roomChange(playing("KQTP"), cast())).toEqual({ room: null });
    expect(roomChange(playing("KQTP"), playing())).toEqual({ room: null });
  });
  it("the TV leaving clears it", () => {
    expect(roomChange(playing("KQTP"), { ...playing("KQTP"), cast: false })).toEqual({
      room: null,
    });
  });
  it("another room: write the new one", () => {
    expect(roomChange(playing("KQTP"), playing("ZZZZ"))).toEqual({
      room: { appId: "night-flight", room: "ZZZZ" },
    });
  });
});
