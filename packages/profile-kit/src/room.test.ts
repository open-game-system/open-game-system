// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ogsRoomFromUrl, postOgsRoom } from "./room";
import { createOgsVerifier } from "./server";
import { createSessionSource, type FrameWindow } from "./session";
import { testKey } from "./test-keys";

/** Several couches, one room (spec §7): the room in, the room out, and the couch on the token. */
function framed() {
  const handlers = new Set<(ev: { data: unknown; source: unknown }) => void>();
  const posted: unknown[] = [];
  const parent = { postMessage: (msg: unknown, _origin: string) => posted.push(msg) };
  const win: FrameWindow = {
    parent,
    postMessage: () => {},
    addEventListener: (_t, h) => handlers.add(h),
    removeEventListener: (_t, h) => handlers.delete(h),
  };
  const fromParent = (data: unknown) => {
    for (const h of handlers) h({ data, source: parent });
  };
  return { win, posted, fromParent };
}

describe("the room a couch joins", () => {
  it("ogs:start's room reaches the TV page's session", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    f.fromParent({
      type: "ogs:start",
      instanceId: "i-1",
      mode: "new",
      roster: [],
      token: "",
      room: "KQTP",
    });
    expect(source.getSnapshot()).toMatchObject({ room: "KQTP" });
  });

  it("a start without a room has none", () => {
    const f = framed();
    const source = createSessionSource({ win: f.win });
    f.fromParent({ type: "ogs:start", instanceId: "i-1", mode: "new", roster: [], token: "" });
    expect(source.getSnapshot()).not.toHaveProperty("room");
  });

  it.each([
    ["https://nf.example/host?ogsRoom=KQTP", "KQTP"],
    ["https://nf.example/host?x=1&ogsRoom=ab_9#top", "ab_9"],
    ["https://nf.example/host", null],
    ["https://nf.example/host?ogsRoom=", null],
    ["https://nf.example/host?ogsRoom=a%20b", null],
    ["not a url", null],
  ])("the phone page's start URL %s names room %s", (url, room) => {
    expect(ogsRoomFromUrl(url)).toBe(room);
  });
});

describe("the TV page says its room", () => {
  it("framed by the launcher: ogs:room", () => {
    const f = framed();
    expect(postOgsRoom("KQTP", f.win)).toBe("launcher");
    expect(f.posted).toEqual([{ type: "ogs:room", room: "KQTP" }]);
  });

  it("not framed: nowhere", () => {
    const win: FrameWindow = {
      postMessage: vi.fn(),
      addEventListener: () => {},
      removeEventListener: () => {},
      parent: null,
    };
    expect(postOgsRoom("KQTP", win)).toBe("none");
    win.parent = win;
    expect(postOgsRoom("KQTP", win)).toBe("none");
    expect(win.postMessage).not.toHaveBeenCalled();
  });

  it("a room that isn't a room id is refused", () => {
    const f = framed();
    expect(() => postOgsRoom("a b", f.win)).toThrow();
    expect(f.posted).toEqual([]);
  });
});

describe("verifyOgsToken: the couch", () => {
  it("returns the couch claim", async () => {
    const key = await testKey("k1");
    const verify = createOgsVerifier({
      jwksUrl: "https://api.test/jwks",
      fetch: async () => Response.json({ keys: [key.publicJwk] }),
      now: () => 1_900_000_100_000,
    });
    const claims = {
      iss: "https://api.opengame.org",
      aud: "night-flight",
      sub: "p_sam",
      handle: "sam",
      name: "Sam",
      avatar: "https://tv.opengame.org/art/story-nook/char-fox.webp",
      couch: { sid: "s-smith", label: "Sam" },
      iat: 1_900_000_000,
      exp: 1_900_003_600,
    };
    const verified = await verify(await key.sign(claims), "night-flight");
    expect(verified?.couch).toEqual({ sid: "s-smith", label: "Sam" });
  });
});
