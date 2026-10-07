import type { Manifest } from "@open-game-system/ogs-protocol";
import { launchPlan } from "../launch-plan";

const game = (tv: Manifest["tv"]): Manifest => ({
  appId: "rocket-crew",
  name: "Rocket Crew",
  tagline: "",
  shape: "couch",
  tv,
  startUrl: "https://rc.example/",
  tvUrl: tv === "none" ? undefined : "https://rc.example/tv",
  roles: [],
  art: { tile: "/art/rc.jpg" },
  shop: {},
  instanceTtlMs: 1000,
});

describe("tapping a game in Library (spec v3, Where a game plays)", () => {
  it("while cast: starts it in the stream with this phone as host, and opens the controller", () => {
    expect(launchPlan({ manifest: game("required"), ogsCast: true, deviceId: "phone-1" })).toEqual({
      kind: "tv",
      start: {
        type: "game.start",
        appId: "rocket-crew",
        mode: "continue",
        hostDeviceId: "phone-1",
      },
      url: "https://rc.example/",
    });
  });

  it("while cast: an optional game also goes to the TV", () => {
    expect(launchPlan({ manifest: game("optional"), ogsCast: true, deviceId: "p" }).kind).toBe(
      "tv",
    );
  });

  it("while cast: a phone-only game opens on the phone and leaves the TV alone", () => {
    expect(launchPlan({ manifest: game("none"), ogsCast: true, deviceId: "p" })).toEqual({
      kind: "phone",
      url: "https://rc.example/",
    });
  });

  it("not cast: tv none or optional plays on the phone", () => {
    for (const tv of ["none", "optional"] as const)
      expect(launchPlan({ manifest: game(tv), ogsCast: false, deviceId: "p" })).toEqual({
        kind: "phone",
        url: "https://rc.example/",
      });
  });

  it("not cast: a TV-required game opens its page instead (its Play asks to cast)", () => {
    expect(launchPlan({ manifest: game("required"), ogsCast: false, deviceId: "p" })).toEqual({
      kind: "needs-tv",
    });
  });

  it("asks for a new sitting when told to", () => {
    const plan = launchPlan({
      manifest: game("required"),
      ogsCast: true,
      deviceId: "p",
      mode: "new",
    });
    expect(plan.kind === "tv" && plan.start.mode).toBe("new");
  });

  it("resumes at the instance's own URL when it has one", () => {
    const plan = launchPlan({
      manifest: game("optional"),
      ogsCast: false,
      deviceId: "p",
      resumeUrl: "https://rc.example/room/AB",
    });
    expect(plan).toEqual({ kind: "phone", url: "https://rc.example/room/AB" });
  });

  it("while cast: Rejoin continues the same instance and opens its room here, not the start page", () => {
    expect(
      launchPlan({
        manifest: game("required"),
        ogsCast: true,
        deviceId: "phone-1",
        resumeUrl: "https://rc.example/join/PQWS?t=seat",
      }),
    ).toEqual({
      kind: "tv",
      start: {
        type: "game.start",
        appId: "rocket-crew",
        mode: "continue",
        hostDeviceId: "phone-1",
      },
      url: "https://rc.example/join/PQWS?t=seat",
    });
  });

  it("while cast: Rejoin of one named sitting tells the session which one", () => {
    const plan = launchPlan({
      manifest: game("required"),
      ogsCast: true,
      deviceId: "p",
      instanceId: "rocket-crew-old",
      resumeUrl: "https://rc.example/join/ABCD",
    });
    expect(plan.kind === "tv" && plan.start.instanceId).toBe("rocket-crew-old");
  });

  it("a new sitting never names an old one", () => {
    const plan = launchPlan({
      manifest: game("required"),
      ogsCast: true,
      deviceId: "p",
      mode: "new",
      instanceId: "rocket-crew-old",
    });
    expect(plan.kind === "tv" && plan.start).not.toHaveProperty("instanceId");
  });

  it("a new sitting always opens the start page, even with an old room to resume", () => {
    for (const ogsCast of [true, false]) {
      const plan = launchPlan({
        manifest: game("optional"),
        ogsCast,
        deviceId: "p",
        mode: "new",
        resumeUrl: "https://rc.example/room/AB",
      });
      expect(plan.kind !== "needs-tv" && plan.url).toBe("https://rc.example/");
    }
  });
});

describe("tapping the game the TV is playing, on a couch phone that didn't start it", () => {
  it("opens the TV's room (ogsRoom), not the plain start page that would make a new room", () => {
    expect(
      launchPlan({
        manifest: game("required"),
        ogsCast: true,
        deviceId: "phone-mom",
        liveRoom: "KQTP",
      }),
    ).toMatchObject({ kind: "tv", url: "https://rc.example/?ogsRoom=KQTP" });
  });

  it("a remembered page of this sitting still wins (it is this phone's own seat)", () => {
    expect(
      launchPlan({
        manifest: game("required"),
        ogsCast: true,
        deviceId: "phone-mom",
        liveRoom: "KQTP",
        resumeUrl: "https://rc.example/join/KQTP?t=2",
      }),
    ).toMatchObject({ kind: "tv", url: "https://rc.example/join/KQTP?t=2" });
  });

  it("New on the live game still joins its room (the TV keeps the game it is playing)", () => {
    expect(
      launchPlan({
        manifest: game("required"),
        ogsCast: true,
        deviceId: "phone-mom",
        mode: "new",
        liveRoom: "KQTP",
      }),
    ).toMatchObject({ kind: "tv", url: "https://rc.example/?ogsRoom=KQTP" });
  });
});
