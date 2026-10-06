import {
  type Instance,
  type InstanceReport,
  initialSession,
  type Manifest,
  reduceSession,
} from "@open-game-system/ogs-protocol";
import { reportSittingFor } from "../game-rejoin";
import { createOgsBridgeStore } from "../ogs-bridge";
import { sittingsFor } from "../sittings";

/**
 * Owner, 2026-10-05: "when i was testing joining story nook i think it joined for me twice? because
 * it created two games at the same minute". Starting Story Nook once while cast opened the couch
 * session's sitting (`story-nook-<time>`) and the phone page's report was stored under the game's
 * own id (`story-nook:<room>`): the game's page listed two sittings, "Room XJNE", both "Just now".
 */
const NOW = 1_780_000_000_000;
const storyNook: Manifest = {
  appId: "story-nook",
  name: "Story Nook",
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: "https://story-nook.example/",
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 7 * 24 * 60 * 60 * 1000,
};

/** The API's POST /me/instances: an upsert by instance id. */
function instancesApi() {
  const rows = new Map<string, Instance>();
  return {
    rows: () => [...rows.values()],
    post: async (report: InstanceReport, source: "bridge" | "visit") => {
      rows.set(report.instanceId, { ...report, profileId: "jon", updatedAt: NOW, source });
    },
  };
}

function startCast() {
  let state = initialSession("s1", "jon");
  state = reduceSession(state, { type: "hello", deviceId: "phone", kind: "phone" }, NOW).state;
  state = reduceSession(state, { type: "hello", deviceId: "tv", kind: "launcher" }, NOW).state;
  return state;
}

describe("starting Story Nook once while cast is one sitting", () => {
  it("the phone page's report and the couch's live sitting are the same sitting", () => {
    const api = instancesApi();
    // The app: Play → game.start (launch-plan "tv"), then the game screen opens the start page.
    let session = reduceSession(
      startCast(),
      { type: "game.start", appId: "story-nook", mode: "new", hostDeviceId: "phone" },
      NOW,
    ).state;
    const store = createOgsBridgeStore(api.post, (appId) => reportSittingFor(appId, session));
    // The TV page labels the couch sitting (ogs:instance → game.resume-point)...
    session = reduceSession(
      session,
      { type: "game.resume-point", appId: "story-nook", label: "Room XJNE" },
      NOW,
    ).state;
    // ...and the phone page reports the same room through the ogs bridge store.
    store.dispatch({
      type: "INSTANCE_REPORT",
      report: {
        instanceId: "story-nook:XJNE",
        appId: "story-nook",
        status: "lobby",
        title: "Room XJNE",
        detail: "",
        resumeUrl: "https://story-nook.example/join/XJNE?t=x&tv=y",
      },
    });

    const sittings = sittingsFor(storyNook, api.rows(), session, NOW);
    expect(sittings).toHaveLength(1);
    expect(sittings[0]).toMatchObject({
      instanceId: session.current?.instanceId,
      label: "Room XJNE",
      live: true,
      resumeUrl: "https://story-nook.example/join/XJNE?t=x&tv=y",
    });
  });
});

describe("which sitting a game's report is filed under", () => {
  const session = reduceSession(
    startCast(),
    { type: "game.start", appId: "story-nook", mode: "new", hostDeviceId: "phone" },
    NOW,
  ).state;

  it("cast: the couch session's live sitting of the game", () => {
    expect(reportSittingFor("story-nook", session)).toBe(session.current?.instanceId);
    expect(session.current?.instanceId).toMatch(/^story-nook-/);
  });

  it("cast, but the report is about another game: that game's own id", () => {
    expect(reportSittingFor("rocket-crew", session)).toBeNull();
  });

  it("cast, nothing on the TV yet: the game's own id", () => {
    expect(reportSittingFor("story-nook", startCast())).toBeNull();
  });

  it("not cast (played on the phone alone, the game's room is the only sitting): its own id", () => {
    expect(reportSittingFor("story-nook", null)).toBeNull();
  });

  it("on a phone alone, the game's report is one sitting under the game's id", () => {
    const api = instancesApi();
    const store = createOgsBridgeStore(api.post, (appId) => reportSittingFor(appId, null));
    store.dispatch({
      type: "INSTANCE_REPORT",
      report: {
        instanceId: "story-nook:KQTP",
        appId: "story-nook",
        status: "lobby",
        title: "Room KQTP",
      },
    });
    const sittings = sittingsFor(storyNook, api.rows(), null, NOW);
    expect(sittings.map((s) => [s.instanceId, s.label])).toEqual([
      ["story-nook:KQTP", "Room KQTP"],
    ]);
  });
});
