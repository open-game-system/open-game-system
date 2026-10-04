import {
  type Instance,
  initialSession,
  type Manifest,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { needsTv, rowAffordance } from "../row-affordance";

const game = (appId: string, tv: Manifest["tv"] = "required"): Manifest => ({
  appId,
  name: appId,
  tagline: "",
  shape: "couch",
  tv,
  startUrl: `https://${appId}.example/`,
  tvUrl: tv === "none" ? undefined : `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 1000,
});

const NOW = 10_000;
const inst = (appId: string, patch: Partial<Instance> = {}): Instance => ({
  instanceId: `${appId}-1`,
  appId,
  householdId: "h1",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: NOW - 10,
  source: "bridge",
  ...patch,
});
const none = { instances: [], session: null, pillAppId: null, now: NOW };

const live = (appId: string): SessionState["current"] => ({
  appId,
  instanceId: "i1",
  mode: "continue",
  roster: [],
  label: "",
  startedAt: 0,
  viewUrl: null,
  hostDeviceId: null,
});

describe("rowAffordance", () => {
  const rc = game("rocket-crew");

  it("is a chevron when there is no couch session", () => {
    expect(rowAffordance(rc, none)).toBe("chevron");
  });

  it("is a chevron when the game is neither live nor paused on the couch", () => {
    expect(rowAffordance(rc, { ...none, session: initialSession("h1") })).toBe("chevron");
  });

  it("is Rejoin when the game is paused in the couch session", () => {
    const s: SessionState = {
      ...initialSession("h1"),
      suspended: [{ appId: "rocket-crew", instanceId: "i1", label: "", at: 0 }],
    };
    expect(rowAffordance(rc, { ...none, session: s })).toBe("rejoin");
    expect(rowAffordance(game("bake-shop"), { ...none, session: s })).toBe("chevron");
  });

  it("is Rejoin when the game is live on the TV", () => {
    const s: SessionState = { ...initialSession("h1"), current: live("rocket-crew") };
    expect(rowAffordance(rc, { ...none, session: s })).toBe("rejoin");
    expect(rowAffordance(game("bake-shop"), { ...none, session: s })).toBe("chevron");
  });
});

describe("rowAffordance for a game you stepped out of without casting", () => {
  const rc = game("rocket-crew", "optional");

  it("is Rejoin while the return pill points at it", () => {
    expect(rowAffordance(rc, { ...none, pillAppId: "rocket-crew" })).toBe("rejoin");
    expect(rowAffordance(rc, { ...none, pillAppId: "bake-shop" })).toBe("chevron");
  });

  it("is Rejoin for an open instance of it", () => {
    expect(rowAffordance(rc, { ...none, instances: [inst("rocket-crew")] })).toBe("rejoin");
    expect(rowAffordance(rc, { ...none, instances: [inst("bake-shop")] })).toBe("chevron");
  });

  it("is a chevron when its instance is finished, expired or older than the game's TTL", () => {
    for (const status of ["completed", "expired"] as const) {
      expect(rowAffordance(rc, { ...none, instances: [inst("rocket-crew", { status })] })).toBe(
        "chevron",
      );
    }
    const stale = inst("rocket-crew", { updatedAt: NOW - 1001 });
    expect(rowAffordance(rc, { ...none, instances: [stale] })).toBe("chevron");
    const edge = inst("rocket-crew", { updatedAt: NOW - 1000 });
    expect(rowAffordance(rc, { ...none, instances: [edge] })).toBe("rejoin");
  });
});

describe("needsTv", () => {
  it("is true only for games that require a TV", () => {
    expect(needsTv(game("a", "required"))).toBe(true);
    expect(needsTv(game("b", "none"))).toBe(false);
    expect(needsTv(game("c", "optional"))).toBe(false);
  });
});
