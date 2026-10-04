import {
  type Instance,
  initialSession,
  type Manifest,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { gameStatusLine, playingSuggestions } from "../library-view";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

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
  instanceTtlMs: 7 * DAY,
});

const inst = (appId: string, patch: Partial<Instance> = {}): Instance => ({
  instanceId: `${appId}-1`,
  appId,
  householdId: "h1",
  status: "suspended",
  title: "",
  detail: "",
  updatedAt: NOW - 1000,
  source: "bridge",
  ...patch,
});

const session = (patch: Partial<SessionState>): SessionState => ({
  ...initialSession("h1"),
  ...patch,
});

describe("each Library game's status line", () => {
  it("New when there's no sitting", () => {
    expect(gameStatusLine(game("rocket-crew"), [], null, NOW)).toBe("New");
  });

  it("the resume point of the newest open sitting", () => {
    const instances = [
      inst("rocket-crew", { instanceId: "a", title: "Mission 4", updatedAt: NOW - 5000 }),
      inst("rocket-crew", { instanceId: "b", title: "Mission 6", updatedAt: NOW - 1000 }),
    ];
    expect(gameStatusLine(game("rocket-crew"), instances, null, NOW)).toBe("Mission 6");
  });

  it("Your turn for an async game waiting on you", () => {
    const instances = [inst("word-duel", { status: "waiting", yourTurn: true, title: "vs Nana" })];
    expect(gameStatusLine(game("word-duel", "none"), instances, null, NOW)).toBe(
      "Your turn · vs Nana",
    );
  });

  it("ignores finished, expired and silent-past-TTL sittings", () => {
    const instances = [
      inst("rocket-crew", { status: "completed", title: "Won" }),
      inst("rocket-crew", { status: "expired", title: "Old" }),
      inst("rocket-crew", { title: "Stale", updatedAt: NOW - 8 * DAY }),
    ];
    expect(gameStatusLine(game("rocket-crew"), instances, null, NOW)).toBe("New");
  });

  it("On the TV now while it's the session's current game", () => {
    const s = session({
      current: {
        appId: "rocket-crew",
        instanceId: "x",
        mode: "continue",
        roster: [],
        label: "",
        startedAt: 0,
        viewUrl: null,
        hostDeviceId: null,
      },
    });
    expect(gameStatusLine(game("rocket-crew"), [], s, NOW)).toBe("On the TV now");
  });

  it("the session's paused label beats an older report", () => {
    const s = session({
      suspended: [{ appId: "rocket-crew", instanceId: "x", label: "Mission 7", at: NOW }],
    });
    const instances = [inst("rocket-crew", { title: "Mission 6" })];
    expect(gameStatusLine(game("rocket-crew"), instances, s, NOW)).toBe("Paused · Mission 7");
  });

  it("a paused sitting without a title still says it's paused", () => {
    expect(gameStatusLine(game("rocket-crew"), [inst("rocket-crew")], null, NOW)).toBe("Paused");
  });
});

describe("Playing's empty state suggests what to start", () => {
  const library = [game("rocket-crew"), game("hearthisle", "optional"), game("word-duel", "none")];

  it("last played first, then what plays where you are (not cast: phone games)", () => {
    const instances = [inst("hearthisle", { status: "completed", updatedAt: NOW - DAY * 3 })];
    expect(playingSuggestions(library, instances, false).map((g) => g.appId)).toEqual([
      "hearthisle",
      "word-duel",
    ]);
  });

  it("cast: couch games for the TV", () => {
    expect(playingSuggestions(library, [], true).map((g) => g.appId)).toEqual([
      "rocket-crew",
      "hearthisle",
    ]);
  });

  it("at most three", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) => game(id, "optional"));
    expect(playingSuggestions(many, [], false)).toHaveLength(3);
  });
});
