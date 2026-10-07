import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeCode,
  couchActionEvent,
  PEER_HEADER,
  peerOfUpgrade,
  readFrame,
  sendAll,
} from "../src/couch-session";

afterEach(() => vi.restoreAllMocks());

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

  it("stamps game.view with its sender, with or without a deviceId (only the host's page frames)", () => {
    const url = "https://rc.example/tv/KQTP";
    for (const sent of [{}, { deviceId: "phone-dad" }]) {
      const frame = JSON.stringify({ type: "game.view", appId: "rocket-crew", url, ...sent });
      expect(readFrame(frame, PEER)).toEqual({
        msg: { type: "game.view", appId: "rocket-crew", url, deviceId: "kid-ipad" },
      });
    }
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

describe("readFrame: tv.rename (the cast moved to another TV)", () => {
  const HOST_PHONE = {
    ...PEER,
    deviceId: "mom-phone",
    kind: "phone" as const,
    profile: { profileId: "mom", name: "Mom", sticker: "bear" },
  };
  const rename = JSON.stringify({ type: "tv.rename", name: "Bedroom TV" });

  it("the caster's phone renames the TV", () => {
    expect(readFrame(rename, HOST_PHONE)).toEqual({
      msg: { type: "tv.rename", name: "Bedroom TV" },
    });
  });

  it.each([
    ["a tablet that joined", PEER],
    ["another phone on the couch", { ...HOST_PHONE, profile: { ...PEER.profile } }],
    ["the launcher", { ...HOST_PHONE, kind: "launcher" as const, profile: undefined }],
    ["the caster's profile on a tablet", { ...HOST_PHONE, kind: "tablet" as const }],
  ])("refuses it from %s (only the caster moves the cast)", (_label, peer) => {
    expect(readFrame(rename, peer)).toEqual({
      error: ["host_only", "Only the caster's phone moves the cast to another TV"],
    });
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

describe("couchActionEvent (one wide event per couch action)", () => {
  const hello = {
    type: "hello" as const,
    deviceId: "kid-ipad",
    kind: "tablet" as const,
    profile: PEER.profile,
  };

  it("an applied action is one console.info line with ids and counts, never the profile's name", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    couchActionEvent("v-1", PEER, hello, { sent: 3, duration_ms: 4 });
    expect(error).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    const line = info.mock.calls[0][0];
    expect(line).toEqual({
      event: "couch.action",
      service: "opengame-api",
      version: "v-1",
      source: "server",
      outcome: "ok",
      action: "hello",
      session_id: "s1",
      host_profile_id: "mom",
      device_id: "kid-ipad",
      device_kind: "tablet",
      profile_id: "kid",
      sent: 3,
      duration_ms: 4,
    });
    expect(JSON.stringify(line)).not.toContain("Kid");
    expect(JSON.stringify(line)).not.toContain("rocket");
  });

  it("a rejected frame says why (info: the client's mistake)", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    couchActionEvent("v-1", PEER, null, { rejected: "invalid_json", duration_ms: 0 });
    expect(info.mock.calls[0][0]).toMatchObject({ action: "rejected", rejected: "invalid_json" });
  });

  it("an action that throws is one console.error line with error.type/message", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    couchActionEvent(
      "v-1",
      PEER,
      { type: "bye", deviceId: "kid-ipad" },
      { error: new TypeError("storage failed"), duration_ms: 2 },
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatchObject({
      event: "couch.action",
      outcome: "error",
      action: "bye",
      error: { type: "TypeError", message: "storage failed" },
    });
  });
});
