import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { signJwt } from "../../src/lib/jwt";
import { CouchClient, couchUrl, isGameFollow } from "./couch-client";
import {
  BASE,
  bearer,
  type CreatedProfile,
  type CreatedSession,
  claimsOf,
  createProfile,
  createSession,
  ErrorSchema,
  joinSession,
  SessionSchema,
} from "./helpers";

const open: CouchClient[] = [];
async function connect(token: string, session?: string) {
  const c = await CouchClient.connect(token, session);
  open.push(c);
  return c;
}
afterEach(async () => {
  for (const c of open.splice(0)) await c.close();
});

/** Join the session with its TV code, then open the couch socket. */
async function joinAndConnect(who: CreatedProfile, session: CreatedSession) {
  const res = await joinSession(who, session.code);
  if (res.status !== 200) throw new Error(`join: ${res.status} ${await res.text()}`);
  return connect(who.token, session.sessionId);
}

/** Jonathan casts from his phone; Juneau's and Ava's iPads join with the TV code. */
async function livingRoom() {
  const jonathan = await createProfile({ name: "Jonathan", sticker: "bear" });
  const juneau = await createProfile({ name: "Juneau", sticker: "dragon", kind: "tablet" });
  const ava = await createProfile({ name: "Ava", sticker: "whale", kind: "tablet" });
  const session = await createSession(jonathan);
  const phone = await connect(jonathan.token, session.sessionId);
  await phone.state((s) => s.devices.length === 1);
  const tv = await connect(session.token);
  const juneauPad = await joinAndConnect(juneau, session);
  const avaPad = await joinAndConnect(ava, session);
  await phone.state((s) => s.devices.filter((d) => d.online).length === 4);
  return {
    session,
    jonathan,
    juneau,
    ava,
    phone,
    tv,
    juneauPad,
    avaPad,
    phoneId: claimsOf(jonathan.token).did,
  };
}

const roster = (r: Awaited<ReturnType<typeof livingRoom>>) => [
  { profileId: r.jonathan.profile.id, roleId: "captain" },
  { profileId: r.juneau.profile.id, roleId: "fixer" },
  { profileId: r.ava.profile.id, roleId: "helper" },
];

const upgrade = { Upgrade: "websocket" };
const errorOf = async (res: Response) => ErrorSchema.parse(await res.json()).error.code;

describe("GET /couch/ws — connecting", () => {
  it("rejects a missing token (401 missing_auth)", async () => {
    const res = await SELF.fetch(`${BASE}/couch/ws`, { headers: upgrade });
    expect(res.status).toBe(401);
    expect(await errorOf(res)).toBe("missing_auth");
  });

  it("rejects a forged or expired token (401 invalid_token)", async () => {
    const p = await createProfile();
    const s = await createSession(p);
    const forged = await signJwt({ ...claimsOf(p.token) }, "wrong-secret");
    const expired = await signJwt({ ...claimsOf(p.token), exp: 1 }, "test-jwt-secret");
    for (const token of [forged, expired, "garbage"]) {
      const res = await SELF.fetch(couchUrl(token, s.sessionId), { headers: upgrade });
      expect(res.status).toBe(401);
      expect(await errorOf(res)).toBe("invalid_token");
    }
  });

  it("asks for a WebSocket upgrade (426 upgrade_required)", async () => {
    const p = await createProfile();
    const s = await createSession(p);
    const res = await SELF.fetch(couchUrl(p.token, s.sessionId));
    expect(res.status).toBe(426);
    expect(await errorOf(res)).toBe("upgrade_required");
  });

  it("a phone must name the session (400 missing_session)", async () => {
    const p = await createProfile();
    const res = await SELF.fetch(couchUrl(p.token), { headers: upgrade });
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("missing_session");
  });

  it("an unknown session is 404 session_not_found", async () => {
    const p = await createProfile();
    const res = await SELF.fetch(couchUrl(p.token, "no-such-session"), { headers: upgrade });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe("session_not_found");
  });

  it("nobody joins automatically: a profile that hasn't joined is refused (403 not_a_member)", async () => {
    const host = await createProfile();
    const mom = await createProfile({ name: "Mom" });
    const s = await createSession(host);
    const res = await SELF.fetch(couchUrl(mom.token, s.sessionId), { headers: upgrade });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe("not_a_member");
  });

  it("a launcher token opens only its own session", async () => {
    const host = await createProfile();
    const [a, b] = [await createSession(host), await createSession(host, "Kitchen TV")];
    const res = await SELF.fetch(couchUrl(a.token, b.sessionId), { headers: upgrade });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe("not_a_member");
    const tv = await connect(a.token);
    expect((await tv.state()).sessionId).toBe(a.sessionId);
  });

  it("sessions are apart: another cast's devices never show up", async () => {
    const mine = await createProfile();
    const theirs = await createProfile({ name: "Neighbour" });
    const [ms, ts] = [await createSession(mine), await createSession(theirs)];
    const myPhone = await connect(mine.token, ms.sessionId);
    await myPhone.state((s) => s.devices.length === 1);
    const theirPhone = await connect(theirs.token, ts.sessionId);
    const theirState = await theirPhone.state();
    expect(theirState.sessionId).toBe(ts.sessionId);
    expect(theirState.devices.map((d) => d.deviceId)).toEqual([claimsOf(theirs.token).did]);
    await new Promise((r) => setTimeout(r, 50));
    expect(myPhone.latest?.devices.map((d) => d.deviceId)).toEqual([claimsOf(mine.token).did]);
  });

  it("identity comes from the token: the host's phone says hello, is a member and holds the remote", async () => {
    const p = await createProfile({ name: "Jonathan", sticker: "bear" });
    const session = await createSession(p);
    const phone = await connect(p.token, session.sessionId);
    const s = await phone.state();
    expect(s.sessionId).toBe(session.sessionId);
    expect(s.hostProfileId).toBe(p.profile.id);
    expect(s.devices).toEqual([
      { deviceId: claimsOf(p.token).did, kind: "phone", profileId: p.profile.id, online: true },
    ]);
    expect(s.members).toEqual([{ profileId: p.profile.id, name: "Jonathan", sticker: "bear" }]);
    expect(s.remote).toBe(claimsOf(p.token).did);
  });

  it("the TV shows who joined: members with their names and stickers, not the launcher", async () => {
    const r = await livingRoom();
    const s = await r.tv.state((x) => x.members.length === 3);
    expect(s.members).toEqual([
      { profileId: r.jonathan.profile.id, name: "Jonathan", sticker: "bear" },
      { profileId: r.juneau.profile.id, name: "Juneau", sticker: "dragon" },
      { profileId: r.ava.profile.id, name: "Ava", sticker: "whale" },
    ]);
  });

  it("refuses a client-sent hello or bye, and survives junk", async () => {
    const p = await createProfile();
    const session = await createSession(p);
    const phone = await connect(p.token, session.sessionId);
    await phone.state();
    for (const junk of [
      { type: "hello", deviceId: "spoof", kind: "launcher" },
      { type: "bye", deviceId: claimsOf(p.token).did },
      { type: "nope" },
      "not json",
    ]) {
      const from = phone.mark();
      if (typeof junk === "string") phone.ws.send(junk);
      else phone.send(junk);
      const err = await phone.next((f) => f.type === "error", from);
      expect(err).toMatchObject({ type: "error", code: expect.any(String) });
    }
    const from = phone.mark();
    phone.send({ type: "focus.set", itemId: "game:bake-shop" });
    const s = await phone.state((x) => x.focus === "game:bake-shop", from);
    expect(s.cast).toBe(false);
    expect(s.devices.map((d) => d.deviceId)).toEqual([claimsOf(p.token).did]);
  });
});

describe("couch session over real WebSockets", () => {
  it("cast from the TV tab: the launcher connects and the session counts exactly 1 cast", async () => {
    const { phone, tv } = await livingRoom();
    const s = await tv.state((x) => x.cast);
    expect(s.casts).toBe(1);
    expect(phone.latest?.casts).toBe(1);
  });

  it("game.start from the phone: launcher shows the game, tablets follow into their roles, the host phone follows host", async () => {
    const room = await livingRoom();
    const { phone, tv, juneauPad, avaPad, phoneId } = room;
    const marks = [tv.mark(), juneauPad.mark(), avaPad.mark(), phone.mark()];
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new", roster: roster(room) });
    const s = await tv.state((x) => x.screen === "game", marks[0]);
    expect(s.current).toMatchObject({ appId: "rocket-crew", hostDeviceId: phoneId, viewUrl: null });
    const instanceId = s.current?.instanceId;
    expect(await juneauPad.next(isGameFollow, marks[1])).toMatchObject({
      target: { kind: "game", appId: "rocket-crew", instanceId, roleId: "fixer" },
    });
    expect(await avaPad.next(isGameFollow, marks[2])).toMatchObject({
      target: { kind: "game", appId: "rocket-crew", instanceId, roleId: "helper" },
    });
    expect(await phone.next(isGameFollow, marks[3])).toMatchObject({
      target: { kind: "game", appId: "rocket-crew", instanceId, roleId: "host" },
    });
    expect(s.casts).toBe(1);
  });

  it("every couch phone follows the TV: Mom's phone follows into the game, then into the room the TV names, and Home brings it back", async () => {
    const { session, phone, tv } = await livingRoom();
    const mom = await createProfile({ name: "Mom", sticker: "fox" });
    const momPhone = await joinAndConnect(mom, session);
    await phone.state((s) => s.devices.filter((d) => d.online).length === 5);
    const m = momPhone.mark();
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    const s = await tv.state((x) => x.screen === "game");
    const instanceId = s.current?.instanceId;
    expect(await momPhone.next(isGameFollow, m)).toEqual({
      type: "follow",
      target: { kind: "game", appId: "rocket-crew", instanceId, roleId: "player" },
    });
    const m2 = momPhone.mark();
    tv.send({ type: "game.room", appId: "rocket-crew", room: "KQTP" });
    expect(await momPhone.next(isGameFollow, m2)).toEqual({
      type: "follow",
      target: { kind: "game", appId: "rocket-crew", instanceId, roleId: "player", room: "KQTP" },
    });
    const m3 = momPhone.mark();
    phone.send({ type: "home" });
    expect(await momPhone.next((f) => f.type === "follow", m3)).toEqual({
      type: "follow",
      target: { kind: "launcher" },
    });
  });

  it("launch from the TV: focus.set and two selects from the remote make the remote phone the host", async () => {
    const { phone, tv, phoneId } = await livingRoom();
    const m = phone.mark();
    phone.send({ type: "focus.set", itemId: "game:rocket-crew" });
    phone.send({ type: "select", deviceId: "someone-else" });
    await tv.state((x) => x.screen === "game-page" && x.page === "rocket-crew");
    phone.send({ type: "select", deviceId: "someone-else" });
    expect(await phone.next(isGameFollow, m)).toMatchObject({
      target: { kind: "game", appId: "rocket-crew", roleId: "host" },
    });
    const s = await tv.state((x) => x.screen === "game");
    expect(s.current?.hostDeviceId).toBe(phoneId);
  });

  it("focus.move from the remote reaches only the launcher", async () => {
    const { phone, tv, juneauPad } = await livingRoom();
    const [mt, mp] = [tv.mark(), juneauPad.mark()];
    phone.send({ type: "focus.move", dir: "right" });
    expect(await tv.next((f) => f.type === "focus.move", mt)).toEqual({
      type: "focus.move",
      dir: "right",
    });
    await tv.state(() => true, mt);
    expect(juneauPad.frames.slice(mp).some((f) => f.type === "focus.move")).toBe(false);
  });

  it("game.view reaches the launcher's state", async () => {
    const { phone, tv } = await livingRoom();
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    await tv.state((x) => x.screen === "game");
    const url = "https://rocket-crew.jonathanrmumm.workers.dev/tv/ROOM1";
    phone.send({ type: "game.view", appId: "rocket-crew", url });
    const s = await tv.state((x) => x.current?.viewUrl === url);
    expect(s.casts).toBe(1);
  });

  it("swipe back (home) suspends the game with its resume label", async () => {
    const { phone, tv } = await livingRoom();
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    const started = await tv.state((x) => x.screen === "game");
    phone.send({ type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" });
    await tv.state((x) => x.current?.label === "Mission 6");
    const m = tv.mark();
    phone.send({ type: "home" });
    const s = await tv.state((x) => x.screen === "home", m);
    expect(s.current).toBeNull();
    expect(s.focus).toBe("game:rocket-crew");
    expect(s.suspended).toEqual([
      {
        appId: "rocket-crew",
        instanceId: started.current?.instanceId,
        label: "Mission 6",
        at: expect.any(Number),
      },
    ]);
  });

  it("switching games keeps the paused game and exactly 1 cast", async () => {
    const { phone, tv } = await livingRoom();
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    await tv.state((x) => x.current?.appId === "rocket-crew");
    phone.send({ type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" });
    await tv.state((x) => x.current?.label === "Mission 6");
    phone.send({ type: "game.start", appId: "bake-shop", mode: "new" });
    const s = await tv.state((x) => x.current?.appId === "bake-shop");
    expect(s.suspended.map((g) => [g.appId, g.label])).toEqual([["rocket-crew", "Mission 6"]]);
    expect(s.casts).toBe(1);
  });

  it("Continue resumes the same instance with its resume point", async () => {
    const { phone, tv } = await livingRoom();
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new" });
    const first = await tv.state((x) => x.screen === "game");
    phone.send({ type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" });
    phone.send({ type: "home" });
    await tv.state((x) => x.screen === "home" && x.suspended.length === 1);
    const m = tv.mark();
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "continue" });
    const s = await tv.state((x) => x.screen === "game", m);
    expect(s.current?.instanceId).toBe(first.current?.instanceId);
    expect(s.current?.label).toBe("Mission 6");
    expect(s.suspended).toEqual([]);
    expect(s.casts).toBe(1);
  });

  it("when the remote phone disconnects, the other phone is offered the remote", async () => {
    const h = await createProfile();
    const session = await createSession(h);
    const jonathan = await connect(h.token, session.sessionId);
    const jonathanId = claimsOf(h.token).did;
    await jonathan.state((s) => s.remote === jonathanId);
    const mom = await joinAndConnect(await createProfile({ name: "Mom" }), session);
    const m = mom.mark();
    await jonathan.close();
    expect(await mom.next((f) => f.type === "remote.offer", m)).toEqual({
      type: "remote.offer",
      from: jonathanId,
    });
    const s = await mom.state((x) => x.remote === null, m);
    expect(s.devices.find((d) => d.deviceId === jonathanId)?.online).toBe(false);
  });

  it("remote.take hands the remote to the sender, whatever deviceId it names", async () => {
    const h = await createProfile();
    const session = await createSession(h);
    const jonathan = await connect(h.token, session.sessionId);
    await jonathan.state();
    const momProfile = await createProfile({ name: "Mom" });
    const momToken = momProfile.token;
    const mom = await joinAndConnect(momProfile, session);
    await mom.state();
    mom.send({ type: "remote.take", deviceId: claimsOf(h.token).did });
    const s = await jonathan.state((x) => x.remote === claimsOf(momToken).did);
    expect(s.remote).toBe(claimsOf(momToken).did);
  });

  it("a launcher leaving ends the cast; the session state survives reconnects", async () => {
    const { jonathan, session, phone, tv } = await livingRoom();
    phone.send({ type: "game.start", appId: "story-nook", mode: "new" });
    phone.send({ type: "home" });
    await phone.state((x) => x.suspended.length === 1);
    const m = phone.mark();
    await tv.close();
    await phone.state((x) => !x.cast, m);
    await phone.close();

    const again = await connect(jonathan.token, session.sessionId);
    const s = await again.state();
    expect(s.suspended.map((g) => g.appId)).toEqual(["story-nook"]);
    expect(s.casts).toBe(1);
  });

  it("Change TV: the caster's tv.rename names the new TV for every client and in D1", async () => {
    const { session, jonathan, juneau, phone, tv, juneauPad } = await livingRoom();
    const m = tv.mark();
    phone.send({ type: "tv.rename", name: "Bedroom TV" });
    expect((await tv.state((x) => x.tvName === "Bedroom TV", m)).tvName).toBe("Bedroom TV");
    expect((await juneauPad.state((x) => x.tvName === "Bedroom TV")).tvName).toBe("Bedroom TV");
    // A launcher that reloads, a phone that joins later, friends' presence: the session row too.
    for (const who of [jonathan, juneau]) {
      const res = await SELF.fetch(`${BASE}/sessions/${session.sessionId}`, {
        headers: bearer(who.token),
      });
      expect(SessionSchema.parse(await res.json()).tvName).toBe("Bedroom TV");
    }
  });

  it("only the caster's phone renames the TV (a tablet that joined is refused)", async () => {
    const { session, jonathan, juneauPad, phone } = await livingRoom();
    const from = juneauPad.mark();
    juneauPad.send({ type: "tv.rename", name: "Juneau's TV" });
    expect(await juneauPad.next((f) => f.type === "error", from)).toMatchObject({
      code: "host_only",
    });
    phone.send({ type: "focus.set", itemId: "game:bake-shop" });
    const s = await phone.state((x) => x.focus === "game:bake-shop");
    expect(s.tvName).toBeUndefined();
    const res = await SELF.fetch(`${BASE}/sessions/${session.sessionId}`, {
      headers: bearer(jonathan.token),
    });
    expect(SessionSchema.parse(await res.json()).tvName).toBe(session.tvName);
  });

  it("a second socket of the same device keeps it online when one closes", async () => {
    const h = await createProfile();
    const session = await createSession(h);
    const did = claimsOf(h.token).did;
    const a = await connect(h.token, session.sessionId);
    const b = await connect(h.token, session.sessionId);
    await b.state();
    const m = b.mark();
    await a.close();
    b.send({ type: "focus.set", itemId: "game:bake-shop" });
    const s = await b.state((x) => x.focus === "game:bake-shop", m);
    expect(s.devices.find((d) => d.deviceId === did)?.online).toBe(true);
    expect(s.remote).toBe(did);
  });
});
