import type { FriendRoom, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { initialSession } from "@open-game-system/ogs-protocol";
import { createRoomJoiner, inviteTarget, roomCards, roomJoinPlan, roomStartUrl } from "../rooms";

/** Several couches, one room (spec §7) in the app: joining, inviting and the Playing cards. */
const nightFlight: Manifest = {
  appId: "night-flight",
  name: "Night Flight",
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: "https://nf.example/host",
  roles: [],
  art: { tile: "/art/nf.jpg" },
  shop: {},
  instanceTtlMs: 1000,
  multiCouch: true,
};
const rocketCrew: Manifest = {
  ...nightFlight,
  appId: "rocket-crew",
  name: "Rocket Crew",
  multiCouch: undefined,
};

describe("roomStartUrl", () => {
  it("adds ogsRoom to the start page", () => {
    expect(roomStartUrl("https://nf.example/host", "KQTP")).toBe(
      "https://nf.example/host?ogsRoom=KQTP",
    );
    expect(roomStartUrl("https://nf.example/host?x=1#a", "KQTP")).toBe(
      "https://nf.example/host?x=1&ogsRoom=KQTP#a",
    );
  });
});

describe("roomJoinPlan", () => {
  it("cast: start the game in the room on this couch and open its start page here", () => {
    expect(
      roomJoinPlan({ manifest: nightFlight, ogsCast: true, deviceId: "phone-sam", room: "KQTP" }),
    ).toEqual({
      kind: "tv",
      start: {
        type: "game.start",
        appId: "night-flight",
        mode: "new",
        hostDeviceId: "phone-sam",
        room: "KQTP",
      },
      url: "https://nf.example/host?ogsRoom=KQTP",
    });
  });
  it("not cast: cast first", () => {
    expect(
      roomJoinPlan({ manifest: nightFlight, ogsCast: false, deviceId: "p", room: "KQTP" }),
    ).toEqual({
      kind: "cast-first",
    });
  });
  it("a game OGS doesn't have, or a single-couch game: can't join", () => {
    expect(
      roomJoinPlan({ manifest: undefined, ogsCast: true, deviceId: "p", room: "KQTP" }).kind,
    ).toBe("unknown-game");
    expect(
      roomJoinPlan({ manifest: rocketCrew, ogsCast: true, deviceId: "p", room: "KQTP" }).kind,
    ).toBe("single-couch");
  });
});

describe("createRoomJoiner", () => {
  function setup(cast = false) {
    let isCast = cast;
    const listeners = new Set<() => void>();
    const sent: unknown[] = [];
    const opened: string[] = [];
    const joiner = createRoomJoiner({
      find: (appId) => [nightFlight, rocketCrew].find((g) => g.appId === appId),
      isCast: () => isCast,
      subscribeCast: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      deviceId: () => "phone-sam",
      send: (m) => sent.push(m),
      open: (game, url) => opened.push(`${game.appId} ${url}`),
    });
    const castNow = () => {
      isCast = true;
      for (const l of [...listeners]) l();
    };
    return { joiner, sent, opened, castNow, listeners };
  }

  it("cast: starts at once", () => {
    const t = setup(true);
    expect(t.joiner.join("night-flight", "KQTP")).toBe("started");
    expect(t.sent).toEqual([
      {
        type: "game.start",
        appId: "night-flight",
        mode: "new",
        hostDeviceId: "phone-sam",
        room: "KQTP",
      },
    ]);
    expect(t.opened).toEqual(["night-flight https://nf.example/host?ogsRoom=KQTP"]);
  });

  it("not cast: waits, and starts once the TV is cast", () => {
    const t = setup(false);
    expect(t.joiner.join("night-flight", "KQTP")).toBe("cast-first");
    expect(t.joiner.pending()).toEqual({ appId: "night-flight", room: "KQTP" });
    expect(t.sent).toEqual([]);
    t.castNow();
    expect(t.sent).toHaveLength(1);
    expect(t.opened).toHaveLength(1);
    expect(t.joiner.pending()).toBeNull();
    expect(t.listeners.size).toBe(0);
    t.castNow();
    expect(t.sent).toHaveLength(1);
  });

  it("a newer join replaces a waiting one; cancel drops it", () => {
    const t = setup(false);
    t.joiner.join("night-flight", "KQTP");
    t.joiner.join("night-flight", "ZZZZ");
    expect(t.joiner.pending()).toEqual({ appId: "night-flight", room: "ZZZZ" });
    expect(t.listeners.size).toBe(1);
    t.joiner.cancel();
    t.castNow();
    expect(t.sent).toEqual([]);
  });

  it("an unknown or single-couch game does nothing", () => {
    const t = setup(true);
    expect(t.joiner.join("nope", "KQTP")).toBe("unknown-game");
    expect(t.joiner.join("rocket-crew", "KQTP")).toBe("single-couch");
    expect(t.sent).toEqual([]);
  });
});

describe("inviteTarget: what Invite friends to this game invites to", () => {
  const live = (over: Partial<NonNullable<SessionState["current"]>> = {}): SessionState => ({
    ...initialSession("s-mumm", "jon"),
    cast: true,
    current: {
      appId: "night-flight",
      instanceId: "nf-1",
      mode: "new",
      roster: [],
      label: "Room KQTP",
      startedAt: 1,
      viewUrl: null,
      hostDeviceId: null,
      room: "KQTP",
      ...over,
    },
  });
  const games = [nightFlight, rocketCrew];
  it("the multiCouch game live on the TV, in its room", () => {
    expect(inviteTarget(live(), games)).toEqual({
      appId: "night-flight",
      name: "Night Flight",
      room: "KQTP",
    });
  });
  it("nothing before the game names its room", () => {
    expect(inviteTarget(live({ room: undefined }), games)).toBeNull();
  });
  it("nothing for single-couch games, unknown games or no game", () => {
    expect(inviteTarget(live({ appId: "rocket-crew" }), games)).toBeNull();
    expect(inviteTarget(live({ appId: "nope" }), games)).toBeNull();
    expect(inviteTarget({ ...live(), current: null }, games)).toBeNull();
    expect(inviteTarget(null, games)).toBeNull();
  });
});

describe("roomCards: Join with your couch on Playing", () => {
  const host = (id: string, name: string) => ({ id, handle: id, name, sticker: "bear" });
  const room = (over: Partial<FriendRoom> = {}): FriendRoom => ({
    appId: "night-flight",
    game: { appId: "night-flight", name: "Night Flight" },
    room: "KQTP",
    couches: [
      { sessionId: "s-mumm", label: "Jonathan", host: host("jon", "Jonathan") },
      { sessionId: "s-smith", label: "Sam", host: host("sam", "Sam") },
    ],
    joined: false,
    ...over,
  });
  it("says who is playing what", () => {
    expect(roomCards([room()])).toEqual([
      {
        key: "night-flight:KQTP",
        appId: "night-flight",
        room: "KQTP",
        title: "Jonathan and Sam are playing Night Flight",
        hosts: [host("jon", "Jonathan"), host("sam", "Sam")],
      },
    ]);
  });
  it("rooms my couch is in already are not offered", () => {
    expect(roomCards([room({ joined: true })])).toEqual([]);
  });
});

describe("createRoomsStore", () => {
  const { createRoomsStore } = jest.requireActual<typeof import("../rooms")>("../rooms");
  const r = {
    appId: "night-flight",
    game: { appId: "night-flight", name: "Night Flight" },
    room: "KQTP",
    couches: [],
    joined: false,
  };
  it("loads friends' rooms and tells listeners", async () => {
    const store = createRoomsStore({ rooms: async () => [r] });
    const seen = jest.fn();
    store.subscribe(seen);
    await store.refresh();
    expect(store.getSnapshot()).toEqual([r]);
    expect(seen).toHaveBeenCalled();
  });
  it("a failed refresh keeps the last rooms", async () => {
    let fail = false;
    const store = createRoomsStore({
      rooms: async () => {
        if (fail) throw new Error("offline");
        return [r];
      },
    });
    await store.refresh();
    fail = true;
    await store.refresh();
    expect(store.getSnapshot()).toEqual([r]);
  });
  it("unsubscribes", async () => {
    const store = createRoomsStore({ rooms: async () => [r] });
    const seen = jest.fn();
    store.subscribe(seen)();
    await store.refresh();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe("invitedLine", () => {
  it.each([
    [[], ""],
    [["Sam"], "Invited Sam."],
    [["Sam", "Kim"], "Invited Sam and Kim."],
    [["Sam", "Kim", "Max"], "Invited Sam, Kim and Max."],
  ])("%j: %s", (names, line) => {
    const { invitedLine } = jest.requireActual<typeof import("../rooms")>("../rooms");
    expect(invitedLine(names)).toBe(line);
  });
});
