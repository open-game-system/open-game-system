import { createCouchSession, type SocketLike } from "../couch-session";
import { createFriendsApi } from "../friends-api";
import { createGameTokenClient } from "../game-profile";

/** Several couches, one room (spec §7): the app's wires to the API and the couch session. */

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("a host follow into a room", () => {
  it("passes the room on, so the start page joins it", () => {
    FakeSocket.all = [];
    const onFollowHost = jest.fn();
    const session = createCouchSession({
      url: "ws://api.test/api/v1/couch/ws?token=t&session=s1",
      deviceId: "phone-1",
      createSocket: (url) => new FakeSocket(url),
      onFollowHost,
    });
    session.start();
    const socket = FakeSocket.all[0];
    socket?.open();
    socket?.receive({
      type: "follow",
      target: {
        kind: "game",
        appId: "night-flight",
        instanceId: "nf-1",
        roleId: "host",
        room: "KQTP",
      },
    });
    expect(onFollowHost).toHaveBeenCalledWith({
      appId: "night-flight",
      instanceId: "nf-1",
      room: "KQTP",
    });
    session.stop();
  });
});

describe("a game token for this couch", () => {
  const grant = {
    token: "t1",
    expiresAt: 5,
    profile: { id: "p", handle: "p", name: "P", avatar: "https://tv.test/a.webp" },
  };

  it("asks with the couch session the phone is on", async () => {
    const fetch = jest.fn(async (_url: string, _init?: RequestInit) => Response.json(grant));
    const client = createGameTokenClient({
      baseUrl: "http://api.test",
      fetch,
      auth: () => ({ token: "profile-token" }),
      sessionId: () => "s-smith",
    });
    await client("night-flight");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ sid: "s-smith" });
  });

  it("no couch: no body, as before", async () => {
    const fetch = jest.fn(async (_url: string, _init?: RequestInit) => Response.json(grant));
    const client = createGameTokenClient({
      baseUrl: "http://api.test",
      fetch,
      auth: () => ({ token: "profile-token" }),
      sessionId: () => null,
    });
    await client("night-flight");
    expect(fetch.mock.calls[0]?.[1]?.body).toBeUndefined();
  });
});

describe("rooms and invites over the API", () => {
  const room = {
    appId: "night-flight",
    game: { appId: "night-flight", name: "Night Flight" },
    room: "KQTP",
    couches: [
      {
        sessionId: "s1",
        label: "Jonathan",
        host: { id: "jon", handle: "j", name: "Jonathan", sticker: "bear" },
      },
    ],
    joined: false,
  };
  function api(body: unknown, status = 200) {
    const calls: { url: string; method: string; body: unknown }[] = [];
    const client = createFriendsApi({
      baseUrl: "http://api.test",
      auth: () => ({ token: "tok" }),
      fetch: async (url, init = {}) => {
        calls.push({
          url,
          method: init.method ?? "GET",
          body: init.body ? JSON.parse(String(init.body)) : undefined,
        });
        return new Response(JSON.stringify(body), { status });
      },
    });
    return { client, calls };
  }

  it("GET /friends/rooms, parsed", async () => {
    const { client, calls } = api([room]);
    expect(await client.rooms()).toEqual([room]);
    expect(calls[0]).toMatchObject({ url: "http://api.test/api/v1/friends/rooms", method: "GET" });
  });

  it("a malformed room list is a BAD_RESPONSE", async () => {
    const { client } = api([{ appId: 1 }]);
    await expect(client.rooms()).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("POST /games/:appId/invites with the room and friends", async () => {
    const result = {
      link: "https://opengame.org/play/night-flight?room=KQTP",
      invited: [{ profileId: "sam", pushed: true }],
    };
    const { client, calls } = api(result, 201);
    expect(await client.inviteToGame("night-flight", "KQTP", ["sam"])).toEqual(result);
    expect(calls[0]).toEqual({
      url: "http://api.test/api/v1/games/night-flight/invites",
      method: "POST",
      body: { room: "KQTP", to: ["sam"] },
    });
  });
});
