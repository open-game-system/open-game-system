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

  it("not cast: a TV-required game offers Cast to play instead", () => {
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
});
