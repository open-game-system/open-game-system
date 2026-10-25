import { describe, expect, it } from "vitest";
import { ROOM_CODE, newRoomCode, route } from "./routes";

const at = (path: string, method = "GET") => route(method, new URL(path, "https://game.example"));

describe("route", () => {
  it("starts a room from / and /host", () => {
    expect(at("/")).toEqual({ kind: "host" });
    expect(at("/host")).toEqual({ kind: "host" });
  });

  it("follows the couch's room when OGS names one", () => {
    expect(at("/host?ogsRoom=abcd")).toEqual({ kind: "follow", roomCode: "ABCD" });
    expect(at("/host?ogsRoom=nope!")).toEqual({ kind: "host" });
  });

  it("serves a room's TV and phone pages, case-insensitive", () => {
    expect(at("/tv/WXYZ")).toEqual({ kind: "page", page: "tv", roomCode: "WXYZ" });
    expect(at("/join/wxyz")).toEqual({ kind: "page", page: "join", roomCode: "WXYZ" });
    expect(at("/join/WXY")).toEqual({ kind: "asset" });
  });

  it("sends /api to actor-kit, POST /events to the client log, the rest to static files", () => {
    expect(at("/api/room/ABCD")).toEqual({ kind: "api" });
    expect(at("/events", "POST")).toEqual({ kind: "events" });
    expect(at("/events")).toEqual({ kind: "asset" });
    expect(at("/healthz")).toEqual({ kind: "health" });
    expect(at("/styles.css")).toEqual({ kind: "asset" });
  });
});

describe("newRoomCode", () => {
  it("is four letters with no look-alikes", () => {
    for (let i = 0; i < 200; i++) expect(newRoomCode()).toMatch(ROOM_CODE);
    expect(newRoomCode(() => 0)).toBe("AAAA");
    expect(newRoomCode(() => 0.999)).toBe("ZZZZ");
  });
});
