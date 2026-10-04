import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { signJwt } from "../../src/lib/jwt";
import { CouchClient, isGameFollow } from "./couch-client";
import {
  BASE,
  type CreatedHousehold,
  claimsOf,
  createHousehold,
  ErrorSchema,
  launcherToken,
  pairDevice,
} from "./helpers";

const open: CouchClient[] = [];
async function connect(token: string) {
  const c = await CouchClient.connect(token);
  open.push(c);
  return c;
}
afterEach(async () => {
  for (const c of open.splice(0)) await c.close();
});

/** Jonathan's phone, the TV launcher, Juneau's and Ava's iPads, all connected. */
async function livingRoom() {
  const h = await createHousehold();
  const [juneau, ava] = [h.people[1], h.people[2]];
  const phone = await connect(h.token);
  await phone.state((s) => s.devices.length === 1);
  const tv = await connect(await launcherToken(h));
  const juneauPad = await connect(
    await pairDevice(h, { kind: "tablet", personId: juneau.id, name: "Juneau's iPad" }),
  );
  const avaPad = await connect(
    await pairDevice(h, { kind: "tablet", personId: ava.id, name: "Ava's iPad" }),
  );
  await phone.state((s) => s.devices.filter((d) => d.online).length === 4);
  return { h, phone, tv, juneauPad, avaPad, phoneId: claimsOf(h.token).did, juneau, ava };
}

const roster = (h: CreatedHousehold) => [
  { personId: h.people[0].id, roleId: "captain" },
  { personId: h.people[1].id, roleId: "fixer" },
  { personId: h.people[2].id, roleId: "helper" },
];

describe("GET /couch/ws — connecting", () => {
  it("rejects a missing token (401 missing_auth)", async () => {
    const res = await SELF.fetch(`${BASE}/couch/ws`, { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(401);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("missing_auth");
  });

  it("rejects a forged or expired token (401 invalid_token)", async () => {
    const h = await createHousehold();
    const forged = await signJwt({ ...claimsOf(h.token) }, "wrong-secret");
    const expired = await signJwt({ ...claimsOf(h.token), exp: 1 }, "test-jwt-secret");
    for (const token of [forged, expired, "garbage"]) {
      const res = await SELF.fetch(`${BASE}/couch/ws?token=${token}`, {
        headers: { Upgrade: "websocket" },
      });
      expect(res.status).toBe(401);
      expect(ErrorSchema.parse(await res.json()).error.code).toBe("invalid_token");
    }
  });

  it("asks for a WebSocket upgrade (426 upgrade_required)", async () => {
    const h = await createHousehold();
    const res = await SELF.fetch(`${BASE}/couch/ws?token=${h.token}`);
    expect(res.status).toBe(426);
    expect(ErrorSchema.parse(await res.json()).error.code).toBe("upgrade_required");
  });

  it("a token of another household joins only its own session", async () => {
    const mine = await createHousehold();
    const theirs = await createHousehold("The Neighbours");
    const myPhone = await connect(mine.token);
    await myPhone.state((s) => s.devices.length === 1);
    const theirPhone = await connect(theirs.token);
    const theirState = await theirPhone.state();
    expect(theirState.householdId).toBe(theirs.householdId);
    expect(theirState.devices.map((d) => d.deviceId)).toEqual([claimsOf(theirs.token).did]);
    await new Promise((r) => setTimeout(r, 50));
    expect(myPhone.latest?.devices.map((d) => d.deviceId)).toEqual([claimsOf(mine.token).did]);
  });

  it("identity comes from the token: the connecting phone says hello and holds the remote", async () => {
    const h = await createHousehold();
    const phone = await connect(h.token);
    const s = await phone.state();
    expect(s.householdId).toBe(h.householdId);
    expect(s.devices).toEqual([
      { deviceId: claimsOf(h.token).did, kind: "phone", personId: h.people[0].id, online: true },
    ]);
    expect(s.remote).toBe(claimsOf(h.token).did);
  });

  it("refuses a client-sent hello or bye, and survives junk", async () => {
    const h = await createHousehold();
    const phone = await connect(h.token);
    await phone.state();
    for (const junk of [
      { type: "hello", deviceId: "spoof", kind: "launcher" },
      { type: "bye", deviceId: claimsOf(h.token).did },
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
    expect(s.devices.map((d) => d.deviceId)).toEqual([claimsOf(h.token).did]);
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
    const { h, phone, tv, juneauPad, avaPad, phoneId } = await livingRoom();
    const marks = [tv.mark(), juneauPad.mark(), avaPad.mark(), phone.mark()];
    phone.send({ type: "game.start", appId: "rocket-crew", mode: "new", roster: roster(h) });
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
    const h = await createHousehold();
    const jonathan = await connect(h.token);
    const jonathanId = claimsOf(h.token).did;
    await jonathan.state((s) => s.remote === jonathanId);
    const mom = await connect(await pairDevice(h, { kind: "phone", name: "Mom's phone" }));
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
    const h = await createHousehold();
    const jonathan = await connect(h.token);
    await jonathan.state();
    const momToken = await pairDevice(h, { kind: "phone", name: "Mom's phone" });
    const mom = await connect(momToken);
    await mom.state();
    mom.send({ type: "remote.take", deviceId: claimsOf(h.token).did });
    const s = await jonathan.state((x) => x.remote === claimsOf(momToken).did);
    expect(s.remote).toBe(claimsOf(momToken).did);
  });

  it("a launcher leaving ends the cast; the session state survives reconnects", async () => {
    const { h, phone, tv } = await livingRoom();
    phone.send({ type: "game.start", appId: "story-nook", mode: "new" });
    phone.send({ type: "home" });
    await phone.state((x) => x.suspended.length === 1);
    const m = phone.mark();
    await tv.close();
    await phone.state((x) => !x.cast, m);
    await phone.close();

    const again = await connect(h.token);
    const s = await again.state();
    expect(s.suspended.map((g) => g.appId)).toEqual(["story-nook"]);
    expect(s.casts).toBe(1);
  });

  it("a second socket of the same device keeps it online when one closes", async () => {
    const h = await createHousehold();
    const did = claimsOf(h.token).did;
    const a = await connect(h.token);
    const b = await connect(h.token);
    await b.state();
    const m = b.mark();
    await a.close();
    b.send({ type: "focus.set", itemId: "game:bake-shop" });
    const s = await b.state((x) => x.focus === "game:bake-shop", m);
    expect(s.devices.find((d) => d.deviceId === did)?.online).toBe(true);
    expect(s.remote).toBe(did);
  });
});
