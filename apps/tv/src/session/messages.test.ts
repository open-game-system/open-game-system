import { initialSession, reduceSession } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { parseServerMessage } from "./messages";

describe("server messages", () => {
  it("parses a state message produced by the protocol reducer", () => {
    let s = initialSession("h1");
    s = reduceSession(
      s,
      { type: "hello", deviceId: "p1", kind: "phone", personId: "jonathan" },
      1,
    ).state;
    s = reduceSession(s, { type: "game.start", appId: "rocket-crew", mode: "new" }, 2).state;
    const parsed = parseServerMessage(JSON.stringify({ type: "state", state: s }));
    expect(parsed).toEqual({ type: "state", state: s });
  });

  it("parses focus.move and error", () => {
    expect(parseServerMessage('{"type":"focus.move","dir":"left"}')).toEqual({
      type: "focus.move",
      dir: "left",
    });
    expect(parseServerMessage('{"type":"error","error":{"code":"x","message":"m"}}')).toMatchObject(
      {
        type: "error",
      },
    );
  });

  it("returns null for junk, unknown types and malformed state", () => {
    expect(parseServerMessage("not json")).toBeNull();
    expect(parseServerMessage('{"type":"follow"}')).toBeNull();
    expect(parseServerMessage('{"type":"focus.move","dir":"sideways"}')).toBeNull();
    expect(parseServerMessage('{"type":"state","state":{"screen":"home"}}')).toBeNull();
  });
});
