import { describe, expect, it } from "vitest";
import { closeCode, PEER_HEADER, peerOfUpgrade, readFrame, sendAll } from "../src/couch-session";

/** The CouchSession DO's pure edges: what it accepts, what it reads from a frame, how it sends. */
const PEER = {
  sessionId: "s1",
  hostProfileId: "mom",
  deviceId: "kid-ipad",
  kind: "tablet" as const,
  profile: { profileId: "kid", name: "Kid", sticker: "rocket" },
};

const upgrade = (peer: unknown, upgradeHeader: string | null = "websocket") => {
  const headers = new Headers();
  if (peer !== undefined) headers.set(PEER_HEADER, JSON.stringify(peer));
  if (upgradeHeader) headers.set("Upgrade", upgradeHeader);
  return new Request("https://couch/ws", { headers });
};

describe("peerOfUpgrade", () => {
  it("reads the verified peer of a WebSocket upgrade", () => {
    expect(peerOfUpgrade(upgrade(PEER, "WebSocket"))).toEqual(PEER);
    const { profile: _none, ...launcher } = { ...PEER, kind: "launcher" as const };
    expect(peerOfUpgrade(upgrade(launcher))).toEqual(launcher);
  });

  it.each([
    ["no peer header", upgrade(undefined)],
    ["a malformed peer", upgrade({ ...PEER, kind: "toaster" })],
    ["no upgrade", upgrade(PEER, null)],
    ["another upgrade", upgrade(PEER, "h2c")],
  ])("refuses %s", (_label, request) => {
    expect(peerOfUpgrade(request)).toBeNull();
  });
});

describe("readFrame", () => {
  it("parses a text or binary frame", () => {
    const frame = JSON.stringify({ type: "focus.set", itemId: "game:trivia" });
    expect(readFrame(frame, PEER)).toEqual({ msg: { type: "focus.set", itemId: "game:trivia" } });
    const bytes = new TextEncoder().encode(frame);
    const binary = new ArrayBuffer(bytes.length);
    new Uint8Array(binary).set(bytes);
    expect(readFrame(binary, PEER)).toEqual({
      msg: { type: "focus.set", itemId: "game:trivia" },
    });
  });

  it.each(["select", "remote.take"])("makes %s act as the sender, whoever it names", (type) => {
    expect(readFrame(JSON.stringify({ type, deviceId: "someone-else" }), PEER)).toEqual({
      msg: { type, deviceId: "kid-ipad" },
    });
  });

  it.each([
    ["not JSON", "{nope", ["invalid_json", "Frames must be JSON"]],
    [
      "not a message",
      JSON.stringify({ type: "dance" }),
      ["invalid_message", "Not a couch session message"],
    ],
    [
      "a hello",
      JSON.stringify({ type: "hello", deviceId: "x", kind: "phone" }),
      ["identity_from_token", "hello and bye come from the token, not the client"],
    ],
    [
      "a bye",
      JSON.stringify({ type: "bye", deviceId: "x" }),
      ["identity_from_token", "hello and bye come from the token, not the client"],
    ],
  ])("answers an error for %s", (_label, data, error) => {
    expect(readFrame(data, PEER)).toEqual({ error });
  });
});

describe("closeCode", () => {
  it.each([
    [1005, 1000],
    [1006, 1000],
    [1000, 1000],
    [4001, 4001],
  ])("echoes %i as %i (1005/1006 can't be sent)", (code, echoed) => {
    expect(closeCode(code)).toBe(echoed);
  });
});

describe("sendAll", () => {
  it("sends every frame and skips sockets that throw (they get their bye on close)", () => {
    const got: string[] = [];
    const open = { send: (f: string) => got.push(`open:${f}`) };
    const closing = {
      send: () => {
        throw new Error("closed");
      },
    };
    sendAll([
      { ws: open, frame: "a" },
      { ws: closing, frame: "b" },
      { ws: open, frame: "c" },
    ]);
    expect(got).toEqual(["open:a", "open:c"]);
  });
});
