import { env } from "cloudflare:test";
import { CastingFriendSchema, type Friend, ONLINE_WINDOW_MS } from "@open-game-system/ogs-protocol";
import { afterEach, describe, expect, it } from "vitest";
import { CouchClient } from "./couch-client";
import { api, befriend, errorOf, friendsOf, person } from "./friends-helpers";
import { type CreatedProfile, createSession, joinSession, SessionSchema } from "./helpers";

const open: CouchClient[] = [];
async function connect(token: string, session?: string) {
  const c = await CouchClient.connect(token, session);
  open.push(c);
  return c;
}
afterEach(async () => {
  for (const c of open.splice(0)) await c.close();
});

async function castingOf(who: CreatedProfile) {
  const res = await api.get(who, "/friends/casting");
  if (res.status !== 200) throw new Error(`casting: ${res.status} ${await res.text()}`);
  return CastingFriendSchema.array().parse(await res.json());
}

/** Polls until `check` passes: the DO writes presence to D1 after the socket frame. */
async function eventually<T>(read: () => Promise<T>, check: (v: T) => boolean): Promise<T> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const v = await read();
    if (check(v) || Date.now() > deadline) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
}

const presenceOf = async (viewer: CreatedProfile, friend: CreatedProfile) =>
  (await friendsOf(viewer)).find((f) => f.id === friend.profile.id)?.presence;

const kindIs = (kind: Friend["presence"]["kind"]) => (p: Friend["presence"] | undefined) =>
  p?.kind === kind;

/** Mom casts to the living room TV and the TV's launcher connects. */
async function momCasts(mom: CreatedProfile) {
  const session = await createSession(mom, "Living room TV");
  const tv = await connect(session.token);
  await tv.state((s) => s.cast);
  return { session, tv };
}

describe("presence", () => {
  it("online when seen in the last 5 minutes, offline after", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    expect(await presenceOf(jonathan, mom)).toEqual({ kind: "online" });
    const old = Date.now() - ONLINE_WINDOW_MS - 1000;
    await env.DB.prepare("UPDATE profile_seen SET last_seen_at = ? WHERE profile_id = ?")
      .bind(old, mom.profile.id)
      .run();
    expect(await presenceOf(jonathan, mom)).toEqual({ kind: "offline", lastSeenAt: old });
  });

  it("any request from the friend's phone brings them back online", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    await env.DB.prepare("UPDATE profile_seen SET last_seen_at = 1 WHERE profile_id = ?")
      .bind(mom.profile.id)
      .run();
    await api.get(mom, "/me");
    expect(await presenceOf(jonathan, mom)).toEqual({ kind: "online" });
  });

  it("casting on <TV> while the TV launcher is connected, with the game once one runs", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    const { session, tv } = await momCasts(mom);
    expect(await eventually(() => presenceOf(jonathan, mom), kindIs("casting"))).toEqual({
      kind: "casting",
      sessionId: session.sessionId,
      tvName: "Living room TV",
      game: null,
    });
    tv.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    expect(
      await eventually(
        () => presenceOf(jonathan, mom),
        (p) => p?.kind === "casting" && p.game !== null,
      ),
    ).toEqual({
      kind: "casting",
      sessionId: session.sessionId,
      tvName: "Living room TV",
      game: { appId: "rocket-crew", name: "Rocket Crew" },
    });
  });

  it("a cast whose TV left is not casting", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    const { tv } = await momCasts(mom);
    await eventually(() => presenceOf(jonathan, mom), kindIs("casting"));
    await tv.close();
    expect(await eventually(() => presenceOf(jonathan, mom), kindIs("online"))).toEqual({
      kind: "online",
    });
  });

  it("a session created but never shown on a TV is not casting", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    await createSession(mom);
    expect(await presenceOf(jonathan, mom)).toEqual({ kind: "online" });
  });

  it("playing <game> when on someone else's live cast that runs a game", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    const juneau = await person("Juneau", "tablet");
    await befriend(jonathan, juneau);
    const { session, tv } = await momCasts(mom);
    expect((await joinSession(juneau, session.code)).status).toBe(200);
    tv.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    expect(await eventually(() => presenceOf(jonathan, juneau), kindIs("playing"))).toEqual({
      kind: "playing",
      sessionId: session.sessionId,
      tvName: "Living room TV",
      game: { appId: "rocket-crew", name: "Rocket Crew" },
    });
  });
});

describe("GET /friends/casting — the Join cards", () => {
  it("lists friends whose TV is live: session, TV, host, game, and whether you joined", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    expect(await castingOf(jonathan)).toEqual([]);
    const { session } = await momCasts(mom);
    const cards = await eventually(
      () => castingOf(jonathan),
      (c) => c.length === 1,
    );
    expect(cards).toEqual([
      {
        sessionId: session.sessionId,
        tvName: "Living room TV",
        host: mom.profile,
        game: null,
        joined: false,
      },
    ]);
    expect((await api.post(jonathan, `/sessions/${session.sessionId}/join`)).status).toBe(200);
    expect((await castingOf(jonathan))[0].joined).toBe(true);
  });

  it("is empty for someone who is not the host's friend, and after the TV leaves", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    const max = await person("Max");
    await befriend(jonathan, mom);
    const { tv } = await momCasts(mom);
    await eventually(
      () => castingOf(jonathan),
      (c) => c.length === 1,
    );
    expect(await castingOf(max)).toEqual([]);
    await tv.close();
    expect(
      await eventually(
        () => castingOf(jonathan),
        (c) => c.length === 0,
      ),
    ).toEqual([]);
  });
});

describe("POST /sessions/:sid/join — Join a friend's cast", () => {
  it("a friend of the host joins without the code and enters the couch", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    const { session, tv } = await momCasts(mom);
    const res = await api.post(jonathan, `/sessions/${session.sessionId}/join`);
    expect(res.status).toBe(200);
    expect(SessionSchema.parse(await res.json())).toEqual({
      sessionId: session.sessionId,
      code: session.code,
      tvName: "Living room TV",
      host: mom.profile,
    });
    await connect(jonathan.token, session.sessionId);
    const state = await tv.state((s) => s.members.some((m) => m.profileId === jonathan.profile.id));
    expect(state.members.map((m) => m.name)).toContain("Jonathan");
    expect((await api.post(jonathan, `/sessions/${session.sessionId}/join`)).status).toBe(200);
  });

  it("the host joining their own session is fine", async () => {
    const mom = await person("Mom");
    const { session } = await momCasts(mom);
    expect((await api.post(mom, `/sessions/${session.sessionId}/join`)).status).toBe(200);
  });

  it("a non-friend is refused (403 not_a_friend) but can still use the TV code", async () => {
    const mom = await person("Mom");
    const max = await person("Max");
    const { session } = await momCasts(mom);
    const res = await api.post(max, `/sessions/${session.sessionId}/join`);
    expect([res.status, await errorOf(res)]).toEqual([403, "not_a_friend"]);
    expect((await joinSession(max, session.code)).status).toBe(200);
  });

  it("a removed friend is refused", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    await api.del(mom, `/friends/${jonathan.profile.id}`);
    const { session } = await momCasts(mom);
    const res = await api.post(jonathan, `/sessions/${session.sessionId}/join`);
    expect(res.status).toBe(403);
  });

  it("404 session_not_found for an unknown or expired session", async () => {
    const jonathan = await person("Jonathan");
    const mom = await person("Mom");
    await befriend(jonathan, mom);
    const res = await api.post(jonathan, "/sessions/nope/join");
    expect([res.status, await errorOf(res)]).toEqual([404, "session_not_found"]);
    const s = await createSession(mom);
    await env.DB.prepare("UPDATE couch_sessions SET created_at = 1 WHERE id = ?")
      .bind(s.sessionId)
      .run();
    expect((await api.post(jonathan, `/sessions/${s.sessionId}/join`)).status).toBe(404);
  });

  it("a launcher token can't join (403 profile_token_required)", async () => {
    const mom = await person("Mom");
    const s = await createSession(mom);
    const res = await fetchJoinAs(s.token, s.sessionId);
    expect([res.status, await errorOf(res)]).toEqual([403, "profile_token_required"]);
  });
});

const fetchJoinAs = (token: string, sid: string) =>
  api.post(
    { token, profile: { id: "", handle: "", name: "", sticker: "" } },
    `/sessions/${sid}/join`,
  );
