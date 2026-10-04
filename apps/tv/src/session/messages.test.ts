import { initialSession, reduceSession } from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import { parseServerMessage } from "./messages";

describe("server messages", () => {
  it("parses a state message produced by the protocol reducer", () => {
    let s = initialSession("s1", "jonathan");
    s = reduceSession(
      s,
      {
        type: "hello",
        deviceId: "p1",
        kind: "phone",
        profile: { profileId: "jonathan", name: "Jonathan", sticker: "bear" },
      },
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
    // A household-era state (no session, host or members) is not this protocol.
    const old = { ...initialSession("s1", "h"), householdId: "mumms" };
    const { sessionId: _s, hostProfileId: _h, members: _m, ...household } = old;
    expect(parseServerMessage(JSON.stringify({ type: "state", state: household }))).toBeNull();
  });
});
