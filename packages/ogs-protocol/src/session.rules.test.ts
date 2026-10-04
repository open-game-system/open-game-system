import { describe, expect, it } from "vitest";
import {
  type ClientMessage,
  ClientMessageSchema,
  initialSession,
  type Outbound,
  playItem,
  readPlayItem,
  reduceSession,
  type SessionState,
  SessionStateSchema,
} from "./session";

const member = (profileId: string) => ({ profileId, name: profileId, sticker: "bear" });
const T = 5_000;
function run(msgs: ClientMessage[], from: SessionState = initialSession("s-1", "dad")) {
  let s = from;
  let last: Outbound[] = [];
  for (const [i, m] of msgs.entries()) {
    const r = reduceSession(s, m, T + i);
    s = r.state;
    last = r.out;
  }
  return { s, last };
}
const hello = (
  deviceId: string,
  kind: "phone" | "tablet" | "launcher",
  profileId?: string,
): ClientMessage =>
  profileId
    ? { type: "hello", deviceId, kind, profile: member(profileId) }
    : { type: "hello", deviceId, kind };
const living = (): ClientMessage[] => [
  hello("phone-dad", "phone", "dad"),
  hello("tv", "launcher"),
  hello("ipad-juneau", "tablet", "juneau"),
  hello("ipad-ava", "tablet", "ava"),
];
const crew = [
  { profileId: "dad", roleId: "captain" },
  { profileId: "juneau", roleId: "fixer" },
];
const startRc: ClientMessage = {
  type: "game.start",
  appId: "rocket-crew",
  mode: "continue",
  roster: crew,
};
const follows = (out: Outbound[]) => out.filter((o) => o.msg.type === "follow");
const offers = (out: Outbound[]) => out.filter((o) => o.msg.type === "remote.offer");

describe("couch session: every reply", () => {
  it("starts with no cast, nothing on screen and no devices", () => {
    expect(initialSession("s-1", "dad")).toEqual({
      sessionId: "s-1",
      hostProfileId: "dad",
      members: [],
      cast: false,
      screen: "home",
      focus: null,
      page: null,
      current: null,
      suspended: [],
      remote: null,
      devices: [],
      rosters: {},
      casts: 0,
    });
  });

  it("broadcasts the new state to everyone first", () => {
    const r = reduceSession(initialSession("s-1", "dad"), hello("phone-dad", "phone"), T);
    expect(r.out[0]).toEqual({ to: "all", msg: { type: "state", state: r.state } });
  });
});

describe("couch session: hello", () => {
  it("lists a device once however often it says hello", () => {
    const { s } = run([hello("phone-dad", "phone", "dad"), hello("phone-dad", "phone", "dad")]);
    expect(s.devices).toEqual([
      { deviceId: "phone-dad", kind: "phone", profileId: "dad", online: true },
    ]);
  });

  it("the first phone gets the remote; a later phone or a tablet doesn't take it", () => {
    const { s } = run([
      hello("ipad-juneau", "tablet", "juneau"),
      hello("phone-dad", "phone", "dad"),
      hello("phone-mom", "phone", "mom"),
    ]);
    expect(s.remote).toBe("phone-dad");
  });

  it("a tablet alone doesn't get the remote", () => {
    expect(run([hello("ipad-juneau", "tablet", "juneau")]).s.remote).toBeNull();
  });

  it("phones and tablets don't cast", () => {
    const { s } = run([hello("phone-dad", "phone"), hello("ipad-juneau", "tablet")]);
    expect(s.cast).toBe(false);
    expect(s.casts).toBe(0);
  });

  it("a device seen as a phone that now connects as a launcher is a new cast", () => {
    const { s } = run([hello("dev-1", "phone"), hello("dev-1", "launcher")]);
    expect(s.casts).toBe(1);
  });

  it("a kid's iPad joining mid-game is sent straight to its role", () => {
    const { s, last } = run([
      hello("phone-dad", "phone", "dad"),
      hello("tv", "launcher"),
      startRc,
      hello("ipad-juneau", "tablet", "juneau"),
    ]);
    expect(follows(last)).toEqual([
      {
        to: { deviceId: "ipad-juneau" },
        msg: {
          type: "follow",
          target: {
            kind: "game",
            appId: "rocket-crew",
            instanceId: s.current?.instanceId,
            roleId: "fixer",
          },
        },
      },
    ]);
  });

  it("a tablet not in the roster joining mid-game goes to the launcher", () => {
    const { last } = run([...living(), startRc, hello("ipad-guest", "tablet", "guest")]);
    expect(follows(last)).toEqual([
      { to: { deviceId: "ipad-guest" }, msg: { type: "follow", target: { kind: "launcher" } } },
    ]);
  });

  it("an online tablet saying hello again gets no new follow", () => {
    const { last } = run([...living(), startRc, hello("ipad-juneau", "tablet", "juneau")]);
    expect(follows(last)).toEqual([]);
  });
});

describe("couch session: members", () => {
  it("keeps the session's id and host", () => {
    const { s } = run(living(), initialSession("s-9", "mom"));
    expect([s.sessionId, s.hostProfileId]).toEqual(["s-9", "mom"]);
  });

  it("everyone who joined is a member, in the order they joined; the launcher is not", () => {
    const { s } = run(living());
    expect(s.members).toEqual([member("dad"), member("juneau"), member("ava")]);
  });

  it("a profile on two devices is one member, with its latest name and sticker", () => {
    const renamed = { profileId: "dad", name: "Jon", sticker: "owl" };
    const { s } = run([
      hello("phone-dad", "phone", "dad"),
      hello("ipad-juneau", "tablet", "juneau"),
      { type: "hello", deviceId: "ipad-dad", kind: "tablet", profile: renamed },
    ]);
    expect(s.members).toEqual([renamed, member("juneau")]);
  });

  it("a member stays on the couch after their device leaves", () => {
    const { s } = run([...living(), { type: "bye", deviceId: "ipad-ava" }]);
    expect(s.members.map((m) => m.profileId)).toEqual(["dad", "juneau", "ava"]);
  });

  it("a hello without a profile adds no member", () => {
    expect(run([hello("phone-x", "phone")]).s.members).toEqual([]);
  });
});

describe("couch session: bye", () => {
  it("marks the device offline but remembers it", () => {
    const { s } = run([...living(), { type: "bye", deviceId: "ipad-ava" }]);
    expect(s.devices.find((d) => d.deviceId === "ipad-ava")).toEqual({
      deviceId: "ipad-ava",
      kind: "tablet",
      profileId: "ava",
      online: false,
    });
    expect(s.devices.filter((d) => d.online)).toHaveLength(3);
  });

  it("a bye from an unknown device changes nothing but is harmless", () => {
    const { s: before } = run(living());
    const { s, last } = run([{ type: "bye", deviceId: "stranger" }], before);
    expect(s).toEqual(before);
    expect(offers(last)).toEqual([]);
  });

  it("a phone or tablet leaving keeps the cast", () => {
    const { s } = run([
      ...living(),
      { type: "bye", deviceId: "ipad-ava" },
      { type: "bye", deviceId: "phone-dad" },
    ]);
    expect(s.cast).toBe(true);
  });

  it("one of two launchers leaving keeps the cast", () => {
    const { s } = run([...living(), hello("tv-2", "launcher"), { type: "bye", deviceId: "tv" }]);
    expect(s.cast).toBe(true);
  });

  it("the last of two launchers leaving drops the cast", () => {
    const { s } = run([
      ...living(),
      hello("tv-2", "launcher"),
      { type: "bye", deviceId: "tv" },
      { type: "bye", deviceId: "tv-2" },
    ]);
    expect(s.cast).toBe(false);
  });

  it("someone without the remote leaving offers it to no one", () => {
    const { s, last } = run([
      ...living(),
      hello("phone-mom", "phone", "mom"),
      { type: "bye", deviceId: "phone-mom" },
    ]);
    expect(s.remote).toBe("phone-dad");
    expect(offers(last)).toEqual([]);
  });

  it("bye of the remote holder offers the remote to the other online phones only", () => {
    const { last } = run([
      ...living(),
      hello("phone-mom", "phone", "mom"),
      hello("phone-nana", "phone", "nana"),
      { type: "bye", deviceId: "phone-nana" },
      { type: "bye", deviceId: "phone-dad" },
    ]);
    expect(offers(last)).toEqual([
      { to: { deviceId: "phone-mom" }, msg: { type: "remote.offer", from: "phone-dad" } },
    ]);
  });

  it("a kid's iPad going dark gets no follow", () => {
    const { last } = run([...living(), startRc, { type: "bye", deviceId: "ipad-juneau" }]);
    expect(follows(last)).toEqual([]);
  });
});

describe("couch session: remote and focus", () => {
  it("any phone can take the remote", () => {
    const { s } = run([...living(), { type: "remote.take", deviceId: "phone-mom" }]);
    expect(s.remote).toBe("phone-mom");
  });

  it("focus.set records the focused item and sends nothing to the launcher", () => {
    const { s, last } = run([...living(), { type: "focus.set", itemId: "game:bake-shop" }]);
    expect(s.focus).toBe("game:bake-shop");
    expect(last).toHaveLength(1);
  });

  it.each(["up", "down", "left", "right"] as const)("forwards focus.move %s", (dir) => {
    const { s: before } = run(living());
    const { s, last } = run([{ type: "focus.move", dir }], before);
    expect(s).toEqual(before);
    expect(last).toEqual([
      { to: "all", msg: { type: "state", state: before } },
      { to: "launcher", msg: { type: "focus.move", dir } },
    ]);
  });
});

describe("couch session: select and back", () => {
  it("select on home opens the focused game's page", () => {
    const { s } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
    ]);
    expect(s.screen).toBe("game-page");
    expect(s.page).toBe("bake-shop");
    expect(s.current).toBeNull();
  });

  it.each([
    null,
    "action:new",
    "shelf:paused",
  ])("select on home with focus %j does nothing", (focus) => {
    const { s: before } = run(living());
    const from = { ...before, focus };
    expect(run([{ type: "select", deviceId: "phone-dad" }], from).s).toEqual(from);
  });

  it("select on the game page with a game focused continues it, hosted by the selecting phone", () => {
    const { s } = run([
      ...living(),
      hello("phone-mom", "phone", "mom"),
      { type: "focus.set", itemId: "game:rocket-crew" },
      { type: "select", deviceId: "phone-dad" },
      { type: "select", deviceId: "phone-mom" },
    ]);
    expect(s.current).toMatchObject({
      appId: "rocket-crew",
      mode: "continue",
      hostDeviceId: "phone-mom",
    });
  });

  it("select during a game does nothing", () => {
    const { s: before } = run([...living(), startRc]);
    const { s } = run([{ type: "select", deviceId: "phone-dad" }], before);
    expect(s).toEqual(before);
  });

  it("back from the game page returns home", () => {
    const { s } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
      { type: "back" },
    ]);
    expect(s.screen).toBe("home");
    expect(s.page).toBeNull();
    expect(s.focus).toBe("game:bake-shop");
  });

  it("back only works from the game page: on home or in a game it does nothing", () => {
    const { s: home } = run(living());
    expect(run([{ type: "back" }], home).s).toEqual(home);
    const { s: playing } = run([...living(), startRc]);
    expect(run([{ type: "back" }], playing).s).toEqual(playing);
  });
});

describe("couch session: play items (cards that start a game at once)", () => {
  const selectOn = (itemId: string, extra: ClientMessage[] = []) =>
    run([
      ...living(),
      ...extra,
      { type: "focus.set", itemId },
      { type: "select", deviceId: "phone-dad" },
    ]);

  it("builds and reads a play item for a game, and for one of its sittings", () => {
    expect(playItem("bake-shop")).toBe("play:bake-shop");
    expect(playItem("bake-shop", "bake-shop-k1:x")).toBe("play:bake-shop:bake-shop-k1:x");
    expect(readPlayItem("play:bake-shop")).toEqual({ appId: "bake-shop" });
    expect(readPlayItem("play:bake-shop:bake-shop-k1:x")).toEqual({
      appId: "bake-shop",
      instanceId: "bake-shop-k1:x",
    });
  });

  it.each([
    null,
    "game:bake-shop",
    "play:",
    "play::i-1",
    "xplay:bake-shop",
    "play:bake-shop:",
    "action:new",
  ])("%j is not a play item", (itemId) => {
    expect(readPlayItem(itemId)).toBeNull();
  });

  it("select on a sitting's play item continues that sitting at once, hosted by the selecting phone", () => {
    const { s } = selectOn(playItem("bake-shop", "bake-shop-k1"));
    expect(s.screen).toBe("game");
    expect(s.page).toBeNull();
    expect(s.focus).toBe("game:bake-shop");
    expect(s.current).toMatchObject({
      appId: "bake-shop",
      instanceId: "bake-shop-k1",
      mode: "continue",
      hostDeviceId: "phone-dad",
    });
  });

  it("select on a game's play item starts it new when nothing of it is paused", () => {
    const { s } = selectOn(playItem("night-flight"));
    expect(s.screen).toBe("game");
    expect(s.current).toMatchObject({
      appId: "night-flight",
      instanceId: `night-flight-${(T + 5).toString(36)}`,
      mode: "new",
    });
  });

  it("another game's paused sitting does not make a play item continue", () => {
    const { s } = selectOn(playItem("night-flight"), [startRc, { type: "home" }]);
    expect(s.current).toMatchObject({ appId: "night-flight", mode: "new" });
  });

  it("select on a game's play item continues its paused sitting", () => {
    const { s } = selectOn(playItem("rocket-crew"), [startRc, { type: "home" }]);
    const paused = run([...living(), startRc]).s.current?.instanceId;
    expect(s.current).toMatchObject({ appId: "rocket-crew", mode: "continue", instanceId: paused });
    expect(s.suspended).toEqual([]);
  });

  it("select on a play item during a game does nothing", () => {
    const { s: playing } = run([...living(), startRc]);
    const from = { ...playing, focus: playItem("night-flight") };
    expect(run([{ type: "select", deviceId: "phone-dad" }], from).s).toEqual(from);
  });

  it("on a game's page a play item focus still selects that page's game", () => {
    const { s: page } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
    ]);
    const from = { ...page, focus: playItem("night-flight") };
    expect(run([{ type: "select", deviceId: "phone-dad" }], from).s.current?.appId).toBe(
      "bake-shop",
    );
  });

  it("the phone that selected a play item follows the new sitting as its host", () => {
    const r = reduceSession(
      run([...living(), { type: "focus.set", itemId: playItem("bake-shop", "bake-shop-k1") }]).s,
      { type: "select", deviceId: "phone-dad" },
      T,
    );
    expect(follows(r.out)).toContainEqual({
      to: { deviceId: "phone-dad" },
      msg: {
        type: "follow",
        target: { kind: "game", appId: "bake-shop", instanceId: "bake-shop-k1", roleId: "host" },
      },
    });
  });
});

describe("couch session: home and end", () => {
  it("home with no game running does nothing", () => {
    const { s: page } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
    ]);
    expect(run([{ type: "home" }], page).s).toEqual(page);
  });

  it("home suspends the game at the time it happened, newest first", () => {
    const { s } = run([
      ...living(),
      startRc,
      { type: "game.start", appId: "bake-shop", mode: "new" },
      { type: "home" },
    ]);
    expect(s.suspended.map((g) => g.appId)).toEqual(["bake-shop", "rocket-crew"]);
    expect(s.suspended[0]?.at).toBe(T + living().length + 2);
  });

  it("a stale paused card for the running game is replaced, not duplicated", () => {
    const { s: playing } = run([...living(), startRc]);
    const current = playing.current;
    if (!current) throw new Error("expected a game");
    const stale = { appId: "rocket-crew", instanceId: "old", label: "Mission 1", at: 1 };
    const other = { appId: "bake-shop", instanceId: "bs", label: "Day 4", at: 2 };
    const { s } = run([{ type: "home" }], { ...playing, suspended: [stale, other] });
    expect(s.suspended).toEqual([
      { appId: "rocket-crew", instanceId: current.instanceId, label: "", at: T },
      other,
    ]);
  });

  it("end suspends the game, returns home and clears cast without a recast", () => {
    const { s: page } = run([
      ...living(),
      startRc,
      { type: "home" },
      { type: "select", deviceId: "phone-dad" },
      startRc,
    ]);
    const { s } = run([{ type: "end" }], page);
    expect(s.screen).toBe("home");
    expect(s.page).toBeNull();
    expect(s.cast).toBe(false);
    expect(s.current).toBeNull();
    expect(s.casts).toBe(1);
    expect(s.suspended.map((g) => g.appId)).toEqual(["rocket-crew"]);
  });

  it("end from the game page closes the page", () => {
    const { s } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
      { type: "end" },
    ]);
    expect(s).toMatchObject({ screen: "home", page: null, cast: false, suspended: [] });
  });

  it("end sends every online kid's iPad back to the launcher", () => {
    const { last } = run([...living(), startRc, { type: "end" }]);
    expect(follows(last)).toEqual([
      { to: { deviceId: "ipad-juneau" }, msg: { type: "follow", target: { kind: "launcher" } } },
      { to: { deviceId: "ipad-ava" }, msg: { type: "follow", target: { kind: "launcher" } } },
    ]);
  });
});

describe("couch session: game.start", () => {
  it("opens the game on the TV with focus on its tile", () => {
    const { s } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
      startRc,
    ]);
    expect(s).toMatchObject({ screen: "game", page: null, focus: "game:rocket-crew" });
    expect(s.current).toEqual({
      appId: "rocket-crew",
      instanceId: `rocket-crew-${(T + 6).toString(36)}`,
      mode: "continue",
      roster: crew,
      label: "",
      startedAt: T + 6,
      viewUrl: null,
      hostDeviceId: "phone-dad",
    });
  });

  it("game.start for the current app is a no-op", () => {
    const { s: playing } = run([...living(), startRc]);
    const r = reduceSession(playing, { type: "game.start", appId: "rocket-crew", mode: "new" }, T);
    expect(r.state).toEqual(playing);
    expect(follows(r.out)).toEqual([]);
  });

  it("a game with no roster given or remembered starts with nobody in a role", () => {
    const { s, last } = run([...living(), { type: "game.start", appId: "bake-shop", mode: "new" }]);
    expect(s.current?.roster).toEqual([]);
    expect(s.rosters).toEqual({ "bake-shop": [] });
    expect(follows(last).map((o) => o.msg)).toEqual([
      expect.objectContaining({ target: expect.objectContaining({ roleId: "host" }) }),
      { type: "follow", target: { kind: "launcher" } },
      { type: "follow", target: { kind: "launcher" } },
    ]);
  });

  it("an explicit host phone wins over the remote holder", () => {
    const { s } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "new", hostDeviceId: "phone-mom" },
    ]);
    expect(s.current?.hostDeviceId).toBe("phone-mom");
  });

  it("with no host and no remote, no phone is told to host", () => {
    const { s, last } = run([hello("ipad-juneau", "tablet", "juneau"), startRc]);
    expect(s.current?.hostDeviceId).toBeNull();
    expect(follows(last)).toHaveLength(1);
    expect(follows(last)[0]?.to).toEqual({ deviceId: "ipad-juneau" });
  });

  it("an explicit instance id is used as is", () => {
    const { s } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", instanceId: "rc-from-link" },
    ]);
    expect(s.current?.instanceId).toBe("rc-from-link");
  });

  it("Rejoin of a named sitting takes its own label, not another paused sitting's", () => {
    const { s: paused } = run([
      ...living(),
      startRc,
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" },
      { type: "home" },
    ]);
    const { s } = run(
      [{ type: "game.start", appId: "rocket-crew", mode: "continue", instanceId: "rc-older" }],
      paused,
    );
    expect(s.current).toMatchObject({ instanceId: "rc-older", label: "" });
  });

  it("Rejoin of another sitting of the live game switches the TV to it", () => {
    const { s: playing } = run([...living(), startRc]);
    const live = playing.current?.instanceId;
    const { s } = run(
      [{ type: "game.start", appId: "rocket-crew", mode: "continue", instanceId: "rc-older" }],
      playing,
    );
    expect(s.current?.instanceId).toBe("rc-older");
    expect(s.suspended.map((g) => g.instanceId)).not.toContain("rc-older");
    expect(live).not.toBe("rc-older");
  });

  it("Rejoin naming the live sitting itself is a no-op", () => {
    const { s: playing } = run([...living(), startRc]);
    const r = reduceSession(
      playing,
      {
        type: "game.start",
        appId: "rocket-crew",
        mode: "continue",
        instanceId: playing.current?.instanceId,
      },
      T,
    );
    expect(r.state).toEqual(playing);
  });

  it("Continue resumes the matching paused game, not the first one", () => {
    const { s: paused } = run([
      ...living(),
      startRc,
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" },
      { type: "game.start", appId: "bake-shop", mode: "new" },
      { type: "game.resume-point", appId: "bake-shop", label: "Day 4" },
      { type: "home" },
    ]);
    const rc = paused.suspended.find((g) => g.appId === "rocket-crew");
    const { s } = run([{ type: "game.start", appId: "rocket-crew", mode: "continue" }], paused);
    expect(s.current).toMatchObject({ instanceId: rc?.instanceId, label: "Mission 6" });
    expect(s.suspended.map((g) => g.appId)).toEqual(["bake-shop"]);
  });

  it("New on a paused game starts a fresh sitting and drops the paused card", () => {
    const { s: paused } = run([...living(), startRc, { type: "home" }]);
    const old = paused.suspended[0]?.instanceId;
    const { s } = run([{ type: "game.start", appId: "rocket-crew", mode: "new" }], paused);
    expect(s.current?.instanceId).not.toBe(old);
    expect(s.current?.label).toBe("");
    expect(s.suspended).toEqual([]);
  });

  it("starting a game doesn't drop other paused cards", () => {
    const { s: paused } = run([...living(), startRc, { type: "home" }]);
    const { s } = run([{ type: "game.start", appId: "bake-shop", mode: "new" }], paused);
    expect(s.suspended.map((g) => g.appId)).toEqual(["rocket-crew"]);
  });
});

describe("couch session: following the game", () => {
  it("tablets follow by role; phones other than the host get nothing", () => {
    const { s, last } = run([...living(), hello("phone-mom", "phone", "mom"), startRc]);
    const id = s.current?.instanceId;
    expect(follows(last)).toEqual([
      {
        to: { deviceId: "phone-dad" },
        msg: {
          type: "follow",
          target: { kind: "game", appId: "rocket-crew", instanceId: id, roleId: "host" },
        },
      },
      {
        to: { deviceId: "ipad-juneau" },
        msg: {
          type: "follow",
          target: { kind: "game", appId: "rocket-crew", instanceId: id, roleId: "fixer" },
        },
      },
      { to: { deviceId: "ipad-ava" }, msg: { type: "follow", target: { kind: "launcher" } } },
    ]);
  });

  it("offline tablets aren't told to follow", () => {
    const { last } = run([...living(), { type: "bye", deviceId: "ipad-juneau" }, startRc]);
    expect(follows(last).map((o) => o.to)).toEqual([
      { deviceId: "phone-dad" },
      { deviceId: "ipad-ava" },
    ]);
  });

  it("unchanged tablets get no follow when nothing about the game changes", () => {
    const { s: playing } = run([...living(), startRc]);
    for (const msg of [
      { type: "game.view", appId: "rocket-crew", url: "https://rc.example/tv" },
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 2" },
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "remote.take", deviceId: "phone-mom" },
    ] satisfies ClientMessage[]) {
      expect(follows(reduceSession(playing, msg, T).out)).toEqual([]);
    }
  });

  it("a swap re-sends every online tablet its new place", () => {
    const { s, last } = run([
      ...living(),
      startRc,
      {
        type: "game.start",
        appId: "bake-shop",
        mode: "new",
        roster: [{ profileId: "ava", roleId: "baker" }],
      },
    ]);
    expect(follows(last).map((o) => [o.to, o.msg])).toEqual([
      [
        { deviceId: "phone-dad" },
        {
          type: "follow",
          target: {
            kind: "game",
            appId: "bake-shop",
            instanceId: s.current?.instanceId,
            roleId: "host",
          },
        },
      ],
      [{ deviceId: "ipad-juneau" }, { type: "follow", target: { kind: "launcher" } }],
      [
        { deviceId: "ipad-ava" },
        {
          type: "follow",
          target: {
            kind: "game",
            appId: "bake-shop",
            instanceId: s.current?.instanceId,
            roleId: "baker",
          },
        },
      ],
    ]);
  });
});

describe("couch session: game reports", () => {
  it("game.view for another app or with no game running is ignored", () => {
    const view: ClientMessage = {
      type: "game.view",
      appId: "bake-shop",
      url: "https://bs.example",
    };
    const { s: playing } = run([...living(), startRc]);
    expect(run([view], playing).s).toEqual(playing);
    const { s: idle } = run(living());
    expect(run([view], idle).s).toEqual(idle);
  });

  it("a resume point for a running game updates its label", () => {
    const { s } = run([
      ...living(),
      startRc,
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 3" },
    ]);
    expect(s.current?.label).toBe("Mission 3");
  });

  it("a resume point for a suspended game updates only that game's card", () => {
    const { s } = run([
      ...living(),
      startRc,
      { type: "game.start", appId: "bake-shop", mode: "new" },
      { type: "game.resume-point", appId: "bake-shop", label: "Day 4" },
      { type: "home" },
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 9" },
    ]);
    expect(s.suspended.map((g) => [g.appId, g.label])).toEqual([
      ["bake-shop", "Day 4"],
      ["rocket-crew", "Mission 9"],
    ]);
  });
});

describe("client message schema", () => {
  const messages: ClientMessage[] = [
    { type: "hello", deviceId: "d", kind: "phone", profile: member("dad") },
    { type: "hello", deviceId: "d", kind: "tablet" },
    { type: "hello", deviceId: "d", kind: "launcher" },
    { type: "bye", deviceId: "d" },
    { type: "focus.set", itemId: "game:rocket-crew" },
    { type: "focus.move", dir: "up" },
    { type: "focus.move", dir: "down" },
    { type: "focus.move", dir: "left" },
    { type: "focus.move", dir: "right" },
    { type: "select", deviceId: "d" },
    { type: "back" },
    { type: "home" },
    { type: "game.start", appId: "rc", mode: "continue" },
    {
      type: "game.start",
      appId: "rc",
      mode: "new",
      roster: [{ profileId: "juneau", roleId: "fixer", deviceId: "ipad" }],
      instanceId: "i",
      hostDeviceId: "phone",
    },
    { type: "game.resume-point", appId: "rc", label: "Mission 6" },
    { type: "game.view", appId: "rc", url: "https://rc.example/tv" },
    { type: "remote.take", deviceId: "d" },
    { type: "end" },
  ];

  it.each(messages.map((m) => [m.type, m]))("accepts %s", (_type, msg) => {
    expect(ClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it.each([
    ["an unknown type", { type: "admin" }],
    ["an empty type", { type: "" }],
    ["hello from an unknown kind", { type: "hello", deviceId: "d", kind: "watch" }],
    ["hello without a device", { type: "hello", kind: "phone" }],
    [
      "hello with a profile without a name",
      { type: "hello", deviceId: "d", kind: "phone", profile: { profileId: "p", sticker: "bear" } },
    ],
    ["bye without a device", { type: "bye" }],
    ["focus.set without an item", { type: "focus.set" }],
    ["a diagonal focus.move", { type: "focus.move", dir: "up-left" }],
    ["select without a device", { type: "select" }],
    ["game.start in an unknown mode", { type: "game.start", appId: "rc", mode: "replay" }],
    ["game.start without an app", { type: "game.start", mode: "new" }],
    ["game.resume-point without a label", { type: "game.resume-point", appId: "rc" }],
    ["game.view with a non-URL", { type: "game.view", appId: "rc", url: "tv page" }],
    ["remote.take without a device", { type: "remote.take" }],
  ])("rejects %s", (_name, msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

describe("session state schema", () => {
  it("parses a state with a game running and its fields intact", () => {
    const { s } = run([
      ...living(),
      startRc,
      { type: "game.view", appId: "rocket-crew", url: "https://rc.example/tv" },
    ]);
    expect(SessionStateSchema.parse(s)).toEqual(s);
  });

  it.each(["home", "game-page", "game"])("accepts the screen %s", (screen) => {
    const state = { ...initialSession("s-1", "dad"), screen };
    expect(SessionStateSchema.parse(state).screen).toBe(screen);
  });

  it("rejects an unknown screen", () => {
    expect(
      SessionStateSchema.safeParse({ ...initialSession("s-1", "dad"), screen: "menu" }).success,
    ).toBe(false);
  });

  it("rejects a current game in an unknown mode", () => {
    const { s } = run([...living(), startRc]);
    const current = { ...s.current, mode: "replay" };
    expect(SessionStateSchema.safeParse({ ...s, current }).success).toBe(false);
  });

  it("accepts a current game in either mode", () => {
    const { s } = run([...living(), { ...startRc, mode: "new" }]);
    expect(SessionStateSchema.parse(s).current?.mode).toBe("new");
  });
});
