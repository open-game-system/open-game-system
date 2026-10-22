import { describe, expect, it } from "vitest";
import type { InstanceReport } from "./instance";
import {
  LIVE_ACTIVITY_STATUS_MAX,
  LiveActivityAttributesSchema,
  LiveActivityContentSchema,
  LiveActivityRegistrationSchema,
  liveActivityChange,
  liveActivityDeepLink,
  readLiveActivityLink,
  sessionContent,
  statusOfReport,
} from "./live-activity";
import { initialSession, type SessionState } from "./session";

const report = (patch: Partial<InstanceReport> = {}): InstanceReport => ({
  instanceId: "rc-1",
  appId: "rocket-crew",
  status: "active",
  title: "",
  detail: "",
  ...patch,
});

describe("statusOfReport: what the lock screen says for a game's own report", () => {
  it.each([
    [{ status: "lobby" as const }, "lobby", "In lobby"],
    [{ status: "waiting" as const }, "waiting", "Waiting for players"],
    [{ status: "active" as const }, "playing", "Playing"],
    [{ status: "suspended" as const }, "playing", "Paused"],
    [{ status: "completed" as const }, "ended", "Game over"],
    [{ status: "expired" as const }, "ended", "Game over"],
  ])("%o reads %s / %s", (patch, phase, status) => {
    expect(statusOfReport(report(patch))).toEqual({ phase, status, yourTurn: false });
  });

  it("puts the title first and says whose turn it is: Round 3 · Your turn", () => {
    expect(statusOfReport(report({ title: "Round 3", yourTurn: true }))).toEqual({
      phase: "playing",
      status: "Round 3 · Your turn",
      yourTurn: true,
    });
  });

  it("says Your turn alone when the game reports no title", () => {
    expect(statusOfReport(report({ status: "waiting", yourTurn: true })).status).toBe("Your turn");
  });

  it("joins title and detail while playing", () => {
    expect(statusOfReport(report({ title: "Mission 6", detail: "Fixing the engine" })).status).toBe(
      "Mission 6 · Fixing the engine",
    );
  });

  it("shows just the title while playing when there is no detail", () => {
    expect(statusOfReport(report({ title: "Mission 6" })).status).toBe("Mission 6");
  });

  it("keeps the title in front of lobby, waiting and paused", () => {
    expect(statusOfReport(report({ status: "lobby", title: "Room 4" })).status).toBe(
      "Room 4 · In lobby",
    );
    expect(statusOfReport(report({ status: "waiting", title: "Round 2" })).status).toBe(
      "Round 2 · Waiting for players",
    );
    expect(statusOfReport(report({ status: "suspended", title: "Round 2" })).status).toBe(
      "Round 2 · Paused",
    );
  });

  it("never says Your turn once the game is over", () => {
    expect(statusOfReport(report({ status: "completed", yourTurn: true }))).toEqual({
      phase: "ended",
      status: "Game over",
      yourTurn: false,
    });
  });

  it("trims whitespace and cuts a long status to the limit with an ellipsis", () => {
    expect(statusOfReport(report({ title: "  Round 3  ", detail: " " })).status).toBe("Round 3");
    const long = statusOfReport(report({ title: "x".repeat(200) })).status;
    expect(long).toHaveLength(LIVE_ACTIVITY_STATUS_MAX);
    expect(long.endsWith("…")).toBe(true);
  });
});

const casting = (patch: Partial<SessionState> = {}): SessionState => ({
  ...initialSession("s1", "mom"),
  cast: true,
  ...patch,
});
const playing = (label: string, room?: string): SessionState =>
  casting({
    screen: "game",
    current: {
      appId: "rocket-crew",
      instanceId: "rc-1",
      mode: "new",
      roster: [],
      label,
      startedAt: 1,
      viewUrl: null,
      hostDeviceId: null,
      ...(room ? { room } : {}),
    },
  });

describe("sessionContent: what the TV's couch session says", () => {
  it("is nothing without a cast or a game on the TV", () => {
    expect(sessionContent(initialSession("s1", "mom"))).toBeNull();
    expect(sessionContent(casting())).toBeNull();
    expect(sessionContent({ ...playing("Mission 6"), cast: false })).toBeNull();
  });

  it("is the game and its resume label while it plays", () => {
    expect(sessionContent(playing("Mission 6"))).toEqual({
      appId: "rocket-crew",
      phase: "playing",
      status: "Mission 6",
      yourTurn: false,
    });
  });

  it("says Playing on the TV until the game reports a label", () => {
    expect(sessionContent(playing(""))?.status).toBe("Playing on the TV");
    expect(sessionContent(playing("   "))?.status).toBe("Playing on the TV");
  });
});

describe("liveActivityChange: what a couch state change does to the activity", () => {
  it("updates when the label changes", () => {
    expect(liveActivityChange(playing("Round 2"), playing("Round 3"))).toEqual({
      kind: "update",
      content: { appId: "rocket-crew", phase: "playing", status: "Round 3", yourTurn: false },
    });
  });

  it("updates when a game starts", () => {
    expect(liveActivityChange(casting(), playing(""))?.kind).toBe("update");
    expect(liveActivityChange(null, playing("Round 1"))?.kind).toBe("update");
  });

  it("does nothing when nothing the activity shows changed", () => {
    expect(liveActivityChange(playing("Round 2"), playing("Round 2"))).toBeNull();
    expect(liveActivityChange(playing("Round 2", "a"), playing("Round 2", "b"))).toBeNull();
    expect(liveActivityChange(casting(), casting({ members: [] }))).toBeNull();
    expect(liveActivityChange(null, casting())).toBeNull();
  });

  it("ends when the cast ends or the TV goes back home", () => {
    expect(liveActivityChange(playing("Round 2"), { ...playing("Round 2"), cast: false })).toEqual({
      kind: "end",
    });
    expect(liveActivityChange(playing("Round 2"), casting())).toEqual({ kind: "end" });
  });
});

describe("schemas", () => {
  it("content: a short status, a phase and whose turn", () => {
    const c = { phase: "playing", status: "Round 3", yourTurn: true, updatedAt: 5 };
    expect(LiveActivityContentSchema.parse(c)).toEqual(c);
    expect(
      LiveActivityContentSchema.safeParse({
        ...c,
        status: "x".repeat(LIVE_ACTIVITY_STATUS_MAX + 1),
      }).success,
    ).toBe(false);
    expect(LiveActivityContentSchema.safeParse({ ...c, phase: "won" }).success).toBe(false);
  });

  it("attributes: game, deep link, an optional room code and art", () => {
    const a = {
      appId: "rocket-crew",
      gameName: "Rocket Crew",
      deepLink: "opengame://live-activity/rocket-crew",
    };
    expect(LiveActivityAttributesSchema.parse(a)).toEqual(a);
    expect(LiveActivityAttributesSchema.parse({ ...a, roomCode: "KXTE42", art: "rc.png" })).toEqual(
      { ...a, roomCode: "KXTE42", art: "rc.png" },
    );
    expect(LiveActivityAttributesSchema.safeParse({ ...a, gameName: "" }).success).toBe(false);
    expect(LiveActivityAttributesSchema.safeParse({ ...a, art: "../etc/passwd" }).success).toBe(
      false,
    );
  });

  it("registration: a hex push token for one activity of one app", () => {
    const r = {
      activityId: "A1B2-C3",
      pushToken: "ab".repeat(40),
      app: "ogs",
      environment: "sandbox",
    };
    expect(LiveActivityRegistrationSchema.parse(r)).toEqual(r);
    expect(LiveActivityRegistrationSchema.safeParse({ ...r, pushToken: "not hex" }).success).toBe(
      false,
    );
    expect(LiveActivityRegistrationSchema.safeParse({ ...r, environment: "dev" }).success).toBe(
      false,
    );
    expect(LiveActivityRegistrationSchema.safeParse({ ...r, app: "Bad App" }).success).toBe(false);
  });
});

describe("the deep link back to the controller", () => {
  it("is <scheme>://live-activity/<appId>", () => {
    expect(liveActivityDeepLink("opengame", "rocket-crew")).toBe(
      "opengame://live-activity/rocket-crew",
    );
  });

  it("reads back the appId from the app's own link, and nothing else", () => {
    expect(readLiveActivityLink("opengame://live-activity/rocket-crew")).toEqual({
      appId: "rocket-crew",
    });
    expect(readLiveActivityLink("settlewood://live-activity/settlewood?x=1")).toEqual({
      appId: "settlewood",
    });
    expect(readLiveActivityLink("opengame://play/rocket-crew")).toBeNull();
    expect(readLiveActivityLink("https://opengame.org/live-activity/rocket-crew")).toBeNull();
    expect(readLiveActivityLink("opengame://live-activity/")).toBeNull();
    expect(readLiveActivityLink("opengame://live-activity/Bad App")).toBeNull();
  });
});
