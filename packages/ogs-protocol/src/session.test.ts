import { describe, expect, it } from "vitest";
import {
  type ClientMessage,
  initialSession,
  reduceSession,
  type SessionState,
  SessionStateSchema,
} from "./session";

const T = 1_000;
function run(msgs: ClientMessage[], from: SessionState = initialSession("hh")) {
  let s = from;
  const outs = [];
  for (const [i, m] of msgs.entries()) {
    const r = reduceSession(s, m, T + i);
    s = r.state;
    outs.push(...r.out);
  }
  return { s, outs };
}
const living = (): ClientMessage[] => [
  { type: "hello", deviceId: "phone-dad", kind: "phone", personId: "dad" },
  { type: "hello", deviceId: "tv", kind: "launcher" },
  { type: "hello", deviceId: "ipad-juneau", kind: "tablet", personId: "juneau" },
  { type: "hello", deviceId: "ipad-ava", kind: "tablet", personId: "ava" },
];
const crew = [
  { personId: "dad", roleId: "captain" },
  { personId: "juneau", roleId: "fixer" },
  { personId: "ava", roleId: "helper" },
];

describe("couch session", () => {
  it("casts once: a launcher connecting is the only recast", () => {
    const { s } = run(living());
    expect(s.cast).toBe(true);
    expect(s.casts).toBe(1);
    expect(s.remote).toBe("phone-dad");
  });

  it("starts a game from the phone and sends each kid iPad its role by name", () => {
    const { s, outs } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
    ]);
    expect(s.screen).toBe("game");
    expect(s.current?.appId).toBe("rocket-crew");
    const follows = outs.filter((o) => o.msg.type === "follow").slice(-2);
    expect(follows).toEqual([
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
      {
        to: { deviceId: "ipad-ava" },
        msg: {
          type: "follow",
          target: {
            kind: "game",
            appId: "rocket-crew",
            instanceId: s.current?.instanceId,
            roleId: "helper",
          },
        },
      },
    ]);
  });

  it("starts a game from the TV: focus, select opens the page, select again starts it", () => {
    const { s } = run([
      ...living(),
      { type: "focus.set", itemId: "game:bake-shop" },
      { type: "select", deviceId: "phone-dad" },
      { type: "select", deviceId: "phone-dad" },
    ]);
    expect(s.current?.appId).toBe("bake-shop");
  });

  it("a game that reported no resume point is suspended with an empty label (the launcher says when, not the label)", () => {
    const { s } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "home" },
    ]);
    expect(s.suspended[0]).toMatchObject({ appId: "rocket-crew", label: "" });
  });

  it("swipe back (home) suspends the game with its resume point and sends kids to the launcher", () => {
    const { s, outs } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" },
      { type: "home" },
    ]);
    expect(s.screen).toBe("home");
    expect(s.current).toBeNull();
    expect(s.suspended[0]).toMatchObject({ appId: "rocket-crew", label: "Mission 6" });
    expect(s.focus).toBe("game:rocket-crew");
    expect(outs.slice(-2).map((o) => o.msg)).toEqual([
      { type: "follow", target: { kind: "launcher" } },
      { type: "follow", target: { kind: "launcher" } },
    ]);
  });

  it("swaps games in the same stream: old one suspended, new one live, zero recasts, Continue resumes the same instance", () => {
    const { s: mid } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 6" },
      { type: "game.start", appId: "bake-shop", mode: "continue", roster: crew },
    ]);
    expect(mid.casts).toBe(1);
    expect(mid.current?.appId).toBe("bake-shop");
    expect(mid.suspended.map((g) => g.appId)).toEqual(["rocket-crew"]);
    const rcInstance = mid.suspended[0]?.instanceId;
    const { s } = run([{ type: "game.start", appId: "rocket-crew", mode: "continue" }], mid);
    expect(s.current?.instanceId).toBe(rcInstance);
    expect(s.current?.label).toBe("Mission 6");
    expect(s.current?.roster).toEqual(crew);
    expect(s.casts).toBe(1);
  });

  it("hands the remote to another grown-up phone when the remote goes dark", () => {
    const { s, outs } = run([
      ...living(),
      { type: "hello", deviceId: "phone-mom", kind: "phone", personId: "mom" },
      { type: "bye", deviceId: "phone-dad" },
    ]);
    expect(s.remote).toBeNull();
    expect(outs.at(-1)).toEqual({
      to: { deviceId: "phone-mom" },
      msg: { type: "remote.offer", from: "phone-dad" },
    });
    const { s: taken } = run([{ type: "remote.take", deviceId: "phone-mom" }], s);
    expect(taken.remote).toBe("phone-mom");
  });

  it("frames the TV view the game asks for, and tells the host phone to open the game", () => {
    const { s, outs } = run([
      ...living(),
      { type: "focus.set", itemId: "game:rocket-crew" },
      { type: "select", deviceId: "phone-dad" },
      { type: "select", deviceId: "phone-dad" },
    ]);
    expect(s.current?.hostDeviceId).toBe("phone-dad");
    expect(s.current?.viewUrl).toBeNull();
    expect(outs).toContainEqual({
      to: { deviceId: "phone-dad" },
      msg: {
        type: "follow",
        target: {
          kind: "game",
          appId: "rocket-crew",
          instanceId: s.current?.instanceId,
          roleId: "host",
        },
      },
    });
    const { s: viewed } = run(
      [
        {
          type: "game.view",
          appId: "rocket-crew",
          url: "https://rocket-crew.example/tv/ABCD?stream=1",
        },
      ],
      s,
    );
    expect(viewed.current?.viewUrl).toBe("https://rocket-crew.example/tv/ABCD?stream=1");
    expect(viewed.casts).toBe(1);
  });

  it("forwards remote moves to the launcher, which owns its own layout", () => {
    const { outs } = run([...living(), { type: "focus.move", dir: "right" }]);
    expect(outs).toContainEqual({ to: "launcher", msg: { type: "focus.move", dir: "right" } });
  });

  it("drops cast when the launcher disconnects, keeping the game to resume", () => {
    const { s } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "bye", deviceId: "tv" },
    ]);
    expect(s.cast).toBe(false);
    expect(s.current?.appId).toBe("rocket-crew");
    const { s: back } = run([{ type: "hello", deviceId: "tv", kind: "launcher" }], s);
    expect(back.cast).toBe(true);
    expect(back.current?.appId).toBe("rocket-crew");
  });

  it("a launcher socket reconnecting is not a recast; a new launcher is", () => {
    const { s } = run([
      ...living(),
      { type: "bye", deviceId: "tv" },
      { type: "hello", deviceId: "tv", kind: "launcher" },
    ]);
    expect(s.casts).toBe(1);
    const { s: again } = run([{ type: "hello", deviceId: "tv-2", kind: "launcher" }], s);
    expect(again.casts).toBe(2);
  });

  it("a resume point reported after home updates the paused card", () => {
    const { s } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "home" },
      { type: "game.resume-point", appId: "rocket-crew", label: "Mission 7" },
    ]);
    expect(s.suspended[0]).toMatchObject({ appId: "rocket-crew", label: "Mission 7" });
  });

  it("on the game page, focusing New and selecting starts a new sitting", () => {
    const { s: paused } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "home" },
    ]);
    const old = paused.suspended[0]?.instanceId;
    const { s } = run(
      [
        { type: "select", deviceId: "phone-dad" },
        { type: "focus.set", itemId: "action:new" },
        { type: "select", deviceId: "phone-dad" },
      ],
      paused,
    );
    expect(s.current?.mode).toBe("new");
    expect(s.current?.instanceId).not.toBe(old);
  });

  it("exports a schema that parses every state the reducer makes", () => {
    const { s } = run([
      ...living(),
      { type: "game.start", appId: "rocket-crew", mode: "continue", roster: crew },
      { type: "home" },
    ]);
    expect(SessionStateSchema.parse(s)).toEqual(s);
    expect(SessionStateSchema.parse(initialSession("hh"))).toEqual(initialSession("hh"));
  });
});
