import { env, SELF } from "cloudflare:test";
import {
  FriendRequestSchema,
  INVITE_TTL_MS,
  inviteTokenFromUrl,
  isInviteCode,
} from "@open-game-system/ogs-protocol";
import { describe, expect, it } from "vitest";
import {
  api,
  befriend,
  errorOf,
  friendsOf,
  invite,
  outcome,
  person,
  redeem,
  requestsOf,
  tokenOf,
} from "./friends-helpers";
import { BASE, bearer, createSession } from "./helpers";

const pub = (p: { profile: { id: string; handle: string; name: string; sticker: string } }) =>
  p.profile;

describe("POST /friends/invites — Add a friend: QR, code and link", () => {
  it("answers a KITE-42 style code, a link, a QR url and a 10 minute expiry", async () => {
    const jonathan = await person("Jonathan");
    const before = Date.now();
    const inv = await invite(jonathan);
    expect(inv.code).toMatch(/^[A-Z]{4}-[2-9]{2}$/);
    expect(isInviteCode(inv.code)).toBe(true);
    expect(inv.link).toMatch(/^https:\/\/opengame\.org\/add\/[A-Za-z0-9_-]{32}$/);
    expect(inv.qr).toMatch(/^https:\/\/opengame\.org\/add\/[A-Za-z0-9_-]{32}$/);
    expect(inv.qr).not.toBe(inv.link);
    expect(inviteTokenFromUrl(inv.link)).toBe(tokenOf(inv.link));
    expect(inv.expiresAt).toBeGreaterThanOrEqual(before + INVITE_TTL_MS);
    expect(inv.expiresAt).toBeLessThanOrEqual(Date.now() + INVITE_TTL_MS);
  });

  it("every invite is new", async () => {
    const jonathan = await person("Jonathan");
    const [a, b] = [await invite(jonathan), await invite(jonathan)];
    expect(a.code).not.toBe(b.code);
    expect(a.link).not.toBe(b.link);
  });

  it("needs a phone or tablet token", async () => {
    const jonathan = await person("Jonathan");
    const s = await createSession(jonathan);
    const res = await SELF.fetch(`${BASE}/friends/invites`, {
      method: "POST",
      headers: bearer(s.token),
    });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe("profile_token_required");
    const anon = await SELF.fetch(`${BASE}/friends/invites`, { method: "POST" });
    expect(anon.status).toBe(401);
  });
});

describe("POST /friends/invites/redeem", () => {
  it("a scanned QR makes you friends at once (both are in the room)", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    const inv = await invite(jonathan);
    const res = await redeem(mom, { token: tokenOf(inv.qr) });
    expect(res.status).toBe(200);
    const o = await outcome(res);
    expect(o).toEqual({
      status: "friends",
      friend: { ...pub(jonathan), presence: { kind: "online" }, since: expect.any(Number) },
    });
    expect((await friendsOf(jonathan)).map((f) => f.id)).toEqual([mom.profile.id]);
    expect((await friendsOf(mom)).map((f) => f.id)).toEqual([jonathan.profile.id]);
    expect(await requestsOf(jonathan)).toEqual({ incoming: [], outgoing: [] });
  });

  it("a typed code sends a request the inviter accepts", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    const inv = await invite(jonathan);
    const typed = inv.code.toLowerCase().replace("-", " ");
    const res = await redeem(max, { code: typed });
    expect(res.status).toBe(201);
    const o = await outcome(res);
    expect(o).toEqual({
      status: "requested",
      request: {
        id: expect.any(String),
        from: pub(max),
        to: pub(jonathan),
        via: "code",
        createdAt: expect.any(Number),
      },
    });
    expect((await requestsOf(jonathan)).incoming.map((r) => r.from.id)).toEqual([max.profile.id]);
    expect((await requestsOf(max)).outgoing.map((r) => r.to.id)).toEqual([jonathan.profile.id]);
    expect(await friendsOf(jonathan)).toEqual([]);
  });

  it("an opened link sends a request (via link)", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    const inv = await invite(jonathan);
    const res = await redeem(max, { token: tokenOf(inv.link) });
    expect(res.status).toBe(201);
    const o = await outcome(res);
    expect(o.status === "requested" && o.request.via).toBe("link");
  });

  it("works once: the second use is 410 invite_used, whichever secret it uses", async () => {
    const jonathan = await person("Jonathan");
    const [mom, max] = [await person("Mom"), await person("Max")];
    const inv = await invite(jonathan);
    expect((await redeem(mom, { code: inv.code })).status).toBe(201);
    for (const body of [
      { code: inv.code },
      { token: tokenOf(inv.link) },
      { token: tokenOf(inv.qr) },
    ]) {
      const res = await redeem(max, body);
      expect(res.status).toBe(410);
      expect(await errorOf(res)).toBe("invite_used");
    }
  });

  it("works for 10 minutes: an expired invite is 410 invite_expired", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    const inv = await invite(jonathan);
    await env.DB.prepare("UPDATE friend_invites SET expires_at = ? WHERE link_token = ?")
      .bind(Date.now() - 1, tokenOf(inv.link))
      .run();
    const res = await redeem(max, { code: inv.code });
    expect(res.status).toBe(410);
    expect(await errorOf(res)).toBe("invite_expired");
  });

  it("an unknown code or token is 404 invite_not_found; an empty body is 400", async () => {
    const max = await person("Max");
    for (const body of [{ code: "ZZZZ-99" }, { token: "x".repeat(32) }]) {
      const res = await redeem(max, body);
      expect(res.status).toBe(404);
      expect(await errorOf(res)).toBe("invite_not_found");
    }
    const bad = await redeem(max, {});
    expect(bad.status).toBe(400);
    expect(await errorOf(bad)).toBe("invalid_body");
  });

  it("you can't add yourself (409 cannot_friend_self), and the invite stays usable", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    const inv = await invite(jonathan);
    const res = await redeem(jonathan, { token: tokenOf(inv.qr) });
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe("cannot_friend_self");
    expect((await redeem(mom, { token: tokenOf(inv.qr) })).status).toBe(200);
  });

  it("redeeming a friend's invite again just says you are friends", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    const inv = await invite(jonathan);
    const res = await redeem(mom, { code: inv.code });
    expect(res.status).toBe(200);
    expect((await outcome(res)).status).toBe("friends");
    expect(await requestsOf(jonathan)).toEqual({ incoming: [], outgoing: [] });
  });

  it("a code from someone who already asked you makes you friends", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    await api.post(max, "/friends/requests", { handle: jonathan.profile.handle });
    const inv = await invite(max);
    const res = await redeem(jonathan, { code: inv.code });
    expect(res.status).toBe(200);
    expect((await outcome(res)).status).toBe("friends");
    expect(await requestsOf(jonathan)).toEqual({ incoming: [], outgoing: [] });
  });
});

describe("POST /friends/requests — find by @id", () => {
  it("sends a request to the profile with that @id (with or without @, any case)", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    const res = await api.post(max, "/friends/requests", {
      handle: `@${jonathan.profile.handle.toUpperCase()}`,
    });
    expect(res.status).toBe(201);
    const o = await outcome(res);
    expect(o.status === "requested" && o.request).toEqual({
      id: expect.any(String),
      from: pub(max),
      to: pub(jonathan),
      via: "handle",
      createdAt: expect.any(Number),
    });
  });

  it("asking twice keeps one request", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    const first = await outcome(
      await api.post(max, "/friends/requests", { handle: jonathan.profile.handle }),
    );
    const again = await api.post(max, "/friends/requests", { handle: jonathan.profile.handle });
    expect(again.status).toBe(201);
    expect(await outcome(again)).toEqual(first);
    expect((await requestsOf(jonathan)).incoming).toHaveLength(1);
  });

  it("asking someone who asked you makes you friends (200) and clears both requests", async () => {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    await api.post(max, "/friends/requests", { handle: jonathan.profile.handle });
    const res = await api.post(jonathan, "/friends/requests", { handle: max.profile.handle });
    expect(res.status).toBe(200);
    const o = await outcome(res);
    expect(o.status === "friends" && o.friend.id).toBe(max.profile.id);
    expect(await requestsOf(max)).toEqual({ incoming: [], outgoing: [] });
  });

  it("404 handle_not_found, 409 cannot_friend_self, 409 already_friends, 400 invalid_body", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    const cases: Array<[unknown, number, string]> = [
      [{ handle: "nobody.has.this" }, 404, "handle_not_found"],
      [{ handle: jonathan.profile.handle }, 409, "cannot_friend_self"],
      [{}, 400, "invalid_body"],
    ];
    for (const [body, status, code] of cases) {
      const res = await api.post(jonathan, "/friends/requests", body);
      expect([res.status, await errorOf(res)]).toEqual([status, code]);
    }
    await befriend(jonathan, mom);
    const res = await api.post(jonathan, "/friends/requests", { handle: mom.profile.handle });
    expect([res.status, await errorOf(res)]).toEqual([409, "already_friends"]);
  });
});

describe("accept and decline", () => {
  async function asked() {
    const jonathan = await person("Jonathan");
    const max = await person("Max");
    const o = await outcome(
      await api.post(max, "/friends/requests", { handle: jonathan.profile.handle }),
    );
    if (o.status !== "requested") throw new Error("expected a request");
    return { jonathan, max, request: FriendRequestSchema.parse(o.request) };
  }

  it("the recipient accepts: both are friends and the request is gone", async () => {
    const { jonathan, max, request } = await asked();
    const res = await api.post(jonathan, `/friends/requests/${request.id}/accept`);
    expect(res.status).toBe(200);
    expect(await outcome(res)).toEqual({
      status: "friends",
      friend: { ...pub(max), presence: { kind: "online" }, since: expect.any(Number) },
    });
    expect((await friendsOf(max)).map((f) => f.id)).toEqual([jonathan.profile.id]);
    expect(await requestsOf(jonathan)).toEqual({ incoming: [], outgoing: [] });
  });

  it("the sender can't accept their own request (404 request_not_found)", async () => {
    const { max, request } = await asked();
    const res = await api.post(max, `/friends/requests/${request.id}/accept`);
    expect([res.status, await errorOf(res)]).toEqual([404, "request_not_found"]);
  });

  it("a stranger can neither accept nor decline it", async () => {
    const { request } = await asked();
    const stranger = await person("Stranger");
    for (const action of ["accept", "decline"]) {
      const res = await api.post(stranger, `/friends/requests/${request.id}/${action}`);
      expect([res.status, await errorOf(res)]).toEqual([404, "request_not_found"]);
    }
  });

  it("the recipient declines (204): gone for both, not friends", async () => {
    const { jonathan, max, request } = await asked();
    const res = await api.post(jonathan, `/friends/requests/${request.id}/decline`);
    expect(res.status).toBe(204);
    expect(await requestsOf(max)).toEqual({ incoming: [], outgoing: [] });
    expect(await friendsOf(jonathan)).toEqual([]);
  });

  it("the sender withdraws with decline", async () => {
    const { jonathan, max, request } = await asked();
    expect((await api.post(max, `/friends/requests/${request.id}/decline`)).status).toBe(204);
    expect(await requestsOf(jonathan)).toEqual({ incoming: [], outgoing: [] });
  });

  it("requests list newest first", async () => {
    const jonathan = await person("Jonathan");
    const [a, b] = [await person("A"), await person("B")];
    await api.post(a, "/friends/requests", { handle: jonathan.profile.handle });
    await new Promise((r) => setTimeout(r, 5));
    await api.post(b, "/friends/requests", { handle: jonathan.profile.handle });
    const { incoming } = await requestsOf(jonathan);
    expect(incoming.map((r) => r.from.name)).toEqual(["B", "A"]);
  });
});

describe("GET /friends and DELETE /friends/:id", () => {
  it("lists friends with only id, @id, name, sticker, presence and since", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    const res = await api.get(jonathan, "/friends");
    const raw: unknown = await res.json();
    expect(raw).toEqual([{ ...pub(mom), presence: { kind: "online" }, since: expect.any(Number) }]);
  });

  it("orders by presence, then name", async () => {
    const jonathan = await person("Jonathan");
    const [nana, juneau] = [await person("Nana"), await person("Juneau", "tablet")];
    await befriend(jonathan, nana);
    await befriend(jonathan, juneau);
    await env.DB.prepare("UPDATE profile_seen SET last_seen_at = 1 WHERE profile_id = ?")
      .bind(juneau.profile.id)
      .run();
    expect((await friendsOf(jonathan)).map((f) => f.name)).toEqual(["Nana", "Juneau"]);
  });

  it("removing a friend is mutual (204), and removing a non-friend is 404 friend_not_found", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    expect((await api.del(jonathan, `/friends/${mom.profile.id}`)).status).toBe(204);
    expect(await friendsOf(jonathan)).toEqual([]);
    expect(await friendsOf(mom)).toEqual([]);
    const res = await api.del(jonathan, `/friends/${mom.profile.id}`);
    expect([res.status, await errorOf(res)]).toEqual([404, "friend_not_found"]);
  });

  it("you can be friends again after removing", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    await api.del(mom, `/friends/${jonathan.profile.id}`);
    await befriend(mom, jonathan);
    expect((await friendsOf(jonathan)).map((f) => f.id)).toEqual([mom.profile.id]);
  });
});
