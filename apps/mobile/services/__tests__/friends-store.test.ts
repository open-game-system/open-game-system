import type {
  CastingFriend,
  Friend,
  FriendOutcome,
  FriendRequest,
  FriendRequests,
} from "@open-game-system/ogs-protocol";
import { createFriendsStore, type JoinResult } from "../friends-store";
import { OgsApiError } from "../ogs-api";

const mom = { id: "p_mom", handle: "mom.m", name: "Mom", sticker: "owl" };
const max = { id: "p_max", handle: "max.k", name: "Max", sticker: "firefly" };
const me = { id: "p_me", handle: "jonathan.m", name: "Jonathan", sticker: "bear" };
const friend = (p = mom): Friend => ({ ...p, presence: { kind: "online" }, since: 1 });
const request: FriendRequest = { id: "r1", from: max, to: me, via: "code", createdAt: 2 };
const card: CastingFriend = {
  sessionId: "s1",
  tvName: "Living room TV",
  host: mom,
  game: null,
  joined: false,
};
const invite = {
  code: "KITE-42",
  link: "https://opengame.org/add/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  qr: "https://opengame.org/add/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  expiresAt: 1_000,
};

function fakeApi() {
  return {
    friends: jest.fn(async (): Promise<Friend[]> => [friend()]),
    requests: jest.fn(async (): Promise<FriendRequests> => ({ incoming: [request], outgoing: [] })),
    casting: jest.fn(async (): Promise<CastingFriend[]> => [card]),
    createInvite: jest.fn(async () => invite),
    redeem: jest.fn(
      async (_by: { code: string } | { token: string }): Promise<FriendOutcome> => ({
        status: "requested",
        request: { ...request, from: me, to: mom },
      }),
    ),
    addByHandle: jest.fn(async (_h: string) => ({
      status: "requested" as const,
      request: { ...request, from: me, to: max, via: "handle" as const },
    })),
    accept: jest.fn(async (_id: string) => ({ status: "friends" as const, friend: friend(max) })),
    decline: jest.fn(async (_id: string) => {}),
    remove: jest.fn(async (_id: string) => {}),
  };
}

beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

function setup() {
  const api = fakeApi();
  const join = jest.fn(async (_sid: string): Promise<JoinResult> => ({ ok: true }));
  const store = createFriendsStore({ api, joinFriendSession: join });
  return { api, join, store };
}

describe("friends store: the list", () => {
  it("starts idle and empty", () => {
    const { store } = setup();
    expect(store.getSnapshot()).toEqual({
      friends: [],
      incoming: [],
      outgoing: [],
      casting: [],
      status: "idle",
      error: null,
    });
  });

  it("refresh loads friends, requests and casts together", async () => {
    const { store } = setup();
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().status));
    await store.refresh();
    expect(store.getSnapshot()).toEqual({
      friends: [friend()],
      incoming: [request],
      outgoing: [],
      casting: [card],
      status: "ready",
      error: null,
    });
    expect(seen).toEqual(["loading", "ready"]);
  });

  it("a failed refresh keeps what it had and says why", async () => {
    const { store, api } = setup();
    await store.refresh();
    api.friends.mockRejectedValueOnce(new OgsApiError("OFFLINE", "down", 0));
    await store.refresh();
    expect(store.getSnapshot()).toMatchObject({
      friends: [friend()],
      status: "error",
      error: { text: "Can't reach OGS. Check your Wi-Fi and try again.", action: "retry" },
    });
  });

  it("refreshCasting reloads only the Join cards, quietly on failure", async () => {
    const { store, api } = setup();
    await store.refreshCasting();
    expect(store.getSnapshot().casting).toEqual([card]);
    expect(api.friends).not.toHaveBeenCalled();
    api.casting.mockRejectedValueOnce(new OgsApiError("OFFLINE", "down", 0));
    await store.refreshCasting();
    expect(store.getSnapshot().casting).toEqual([card]);
    expect(store.getSnapshot().error).toBeNull();
  });

  it("unsubscribe stops notifications", async () => {
    const { store } = setup();
    const listener = jest.fn();
    const off = store.subscribe(listener);
    off();
    await store.refresh();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("friends store: adding", () => {
  it("a typed code redeems the invite (normalised) and refreshes", async () => {
    const { store, api } = setup();
    expect(await store.addByCode(" kite-42 ")).toEqual({
      ok: true,
      outcome: "requested",
      name: "Mom",
    });
    expect(api.redeem).toHaveBeenCalledWith({ code: "KITE42" });
    expect(api.requests).toHaveBeenCalled();
  });

  it("a code that can't be one is refused before asking OGS", async () => {
    const { store, api } = setup();
    expect(await store.addByCode("hello")).toEqual({
      ok: false,
      reason: "not_a_code",
      message: "Codes look like KITE-42.",
      action: null,
    });
    expect(api.redeem).not.toHaveBeenCalled();
  });

  it("an opened or scanned link redeems its token; a scan in person befriends", async () => {
    const { store, api } = setup();
    api.redeem.mockResolvedValueOnce({ status: "friends", friend: friend() });
    expect(await store.addByLink(invite.qr)).toEqual({ ok: true, outcome: "friends", name: "Mom" });
    expect(api.redeem).toHaveBeenCalledWith({ token: "b".repeat(32) });
  });

  it("a link that is not an OGS invite is refused", async () => {
    const { store, api } = setup();
    expect(await store.addByLink("https://example.com/x")).toMatchObject({
      ok: false,
      reason: "not_an_invite",
    });
    expect(api.redeem).not.toHaveBeenCalled();
  });

  it("find by @id sends the handle as typed", async () => {
    const { store, api } = setup();
    expect(await store.addByHandle("@max.k")).toEqual({
      ok: true,
      outcome: "requested",
      name: "Max",
    });
    expect(api.addByHandle).toHaveBeenCalledWith("@max.k");
  });

  it("an empty @id is refused before asking OGS", async () => {
    const { store, api } = setup();
    expect(await store.addByHandle(" @ ")).toMatchObject({ ok: false, reason: "empty" });
    expect(api.addByHandle).not.toHaveBeenCalled();
  });

  it("an API refusal comes back in words", async () => {
    const { store, api } = setup();
    api.addByHandle.mockRejectedValueOnce(new OgsApiError("handle_not_found", "x", 404));
    expect(await store.addByHandle("nobody")).toEqual({
      ok: false,
      reason: "error",
      message: "Nobody has that @id.",
      action: null,
    });
  });

  it("makes an invite for Add a friend, and a failure is in words", async () => {
    const { store, api } = setup();
    expect(await store.newInvite()).toEqual({ ok: true, invite });
    api.createInvite.mockRejectedValueOnce(new OgsApiError("OFFLINE", "x", 0));
    expect(await store.newInvite()).toMatchObject({ ok: false, reason: "error", action: "retry" });
  });
});

describe("friends store: requests, removing, joining", () => {
  it("accept, decline and remove call OGS then refresh", async () => {
    const { store, api } = setup();
    expect(await store.accept("r1")).toEqual({ ok: true });
    expect(await store.decline("r1")).toEqual({ ok: true });
    expect(await store.remove("p_mom")).toEqual({ ok: true });
    expect(api.accept).toHaveBeenCalledWith("r1");
    expect(api.decline).toHaveBeenCalledWith("r1");
    expect(api.remove).toHaveBeenCalledWith("p_mom");
    expect(api.friends).toHaveBeenCalledTimes(3);
  });

  it("a failed accept says why", async () => {
    const { store, api } = setup();
    api.accept.mockRejectedValueOnce(new OgsApiError("request_not_found", "x", 404));
    expect(await store.accept("r1")).toEqual({
      ok: false,
      reason: "error",
      message: "That request is gone.",
      action: null,
    });
  });

  it("joining a friend's cast goes through the app's session and refreshes the cards", async () => {
    const { store, join, api } = setup();
    expect(await store.joinCast("s1")).toEqual({ ok: true });
    expect(join).toHaveBeenCalledWith("s1");
    expect(api.casting).toHaveBeenCalled();
  });

  it("a refused join is passed back", async () => {
    const { store, join } = setup();
    const refused: JoinResult = { ok: false, reason: "not_a_friend", message: "m", action: null };
    join.mockResolvedValueOnce(refused);
    expect(await store.joinCast("s1")).toEqual(refused);
  });
});
