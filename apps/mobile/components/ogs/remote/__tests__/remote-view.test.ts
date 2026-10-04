import { initialSession, type Manifest, type SessionState } from "@open-game-system/ogs-protocol";
import { nowLine, pickerDevices, remoteView } from "../remote-view";

const game = (appId: string, name: string): Manifest => ({
  appId,
  name,
  tagline: "",
  shape: "couch",
  tv: "required",
  startUrl: `https://${appId}.example/`,
  tvUrl: `https://${appId}.example/tv`,
  roles: [],
  art: { tile: "/t.jpg" },
  shop: {},
  instanceTtlMs: 1000,
});

const library = [game("rocket-crew", "Rocket Crew"), game("bake-shop", "Bake Shop")];

const session = (patch: Partial<SessionState> = {}): SessionState => ({
  ...initialSession("s1", "p-dad"),
  cast: true,
  members: [
    { profileId: "p-dad", name: "Dad", sticker: "owl" },
    { profileId: "p-mom", name: "Mom", sticker: "whale" },
  ],
  devices: [
    { deviceId: "phone-dad", kind: "phone", profileId: "p-dad", online: true },
    { deviceId: "phone-mom", kind: "phone", profileId: "p-mom", online: true },
    { deviceId: "phone-guest", kind: "phone", online: true },
  ],
  ...patch,
});

const playing = (appId: string, label = ""): SessionState["current"] => ({
  appId,
  instanceId: "i1",
  mode: "continue",
  roster: [],
  label,
  startedAt: 0,
  viewUrl: null,
  hostDeviceId: null,
});

const view = (state: SessionState | null, me = "phone-dad") =>
  remoteView({ state, library, myDeviceId: me });

describe("remoteView: what's on the TV", () => {
  it("no session yet: the TV shows Home", () => {
    expect(view(null).onTv).toEqual({ kind: "home", focus: null, paused: null });
  });

  it("nothing playing: Home", () => {
    expect(view(session()).onTv).toEqual({ kind: "home", focus: null, paused: null });
  });

  it("the TV at Home even with a game held in the session: Home", () => {
    expect(view(session({ screen: "home", current: playing("rocket-crew") })).onTv).toMatchObject({
      kind: "home",
    });
  });

  it("Home: the game the TV's focus ring is on (what OK will open)", () => {
    expect(view(session({ focus: "game:bake-shop" })).onTv).toMatchObject({
      kind: "home",
      focus: "Bake Shop",
    });
  });

  it("Home: a card that starts a game at once (a sitting, Surprise me's pick) names that game", () => {
    expect(view(session({ focus: "play:bake-shop:bake-shop-k1" })).onTv).toMatchObject({
      kind: "home",
      focus: "Bake Shop",
    });
    expect(view(session({ focus: "play:rocket-crew" })).onTv).toMatchObject({
      focus: "Rocket Crew",
    });
  });

  it("Home: focus on something that isn't a game reads as no focus", () => {
    expect(view(session({ focus: "settings" })).onTv).toMatchObject({ focus: null });
  });

  it("Home: the most recently paused game", () => {
    const s = session({
      suspended: [
        { appId: "bake-shop", instanceId: "b", label: "", at: 1 },
        { appId: "rocket-crew", instanceId: "r", label: "Mission 6", at: 5 },
      ],
    });
    expect(view(s).onTv).toMatchObject({ kind: "home", paused: "Rocket Crew" });
  });

  it("a game playing: its library entry, with where you are in it", () => {
    expect(
      view(session({ screen: "game", current: playing("rocket-crew", "Mission 6") })).onTv,
    ).toEqual({ kind: "game", name: "Rocket Crew", game: library[0], detail: "Mission 6" });
  });

  it("a game playing with no resume point yet: no detail line", () => {
    const onTv = view(session({ screen: "game", current: playing("bake-shop") })).onTv;
    expect(onTv).toMatchObject({ kind: "game", name: "Bake Shop", detail: null });
  });

  it("a game not in this phone's library still shows, by its id", () => {
    expect(view(session({ screen: "game", current: playing("word-duel") })).onTv).toEqual({
      kind: "game",
      name: "word-duel",
      game: null,
      detail: null,
    });
  });

  it("a game's page open on the TV (before it starts)", () => {
    expect(view(session({ screen: "game-page", page: "bake-shop" })).onTv).toEqual({
      kind: "page",
      name: "Bake Shop",
      game: library[1],
    });
  });

  it("a game's page over a suspended game still reads as the page", () => {
    const s = session({ screen: "game-page", page: "rocket-crew", current: playing("bake-shop") });
    expect(view(s).onTv).toMatchObject({ kind: "page", name: "Rocket Crew" });
  });
});

describe("remoteView: who has the remote", () => {
  it("this phone, with its person's sticker", () => {
    expect(view(session({ remote: "phone-dad" })).holder).toEqual({ kind: "me", sticker: "owl" });
  });

  it("this phone without a person: no sticker", () => {
    expect(view(session({ remote: "phone-guest" }), "phone-guest").holder).toEqual({
      kind: "me",
      sticker: null,
    });
  });

  it("another grown-up, by name and sticker", () => {
    expect(view(session({ remote: "phone-mom" })).holder).toEqual({
      kind: "person",
      name: "Mom",
      sticker: "whale",
    });
  });

  it("a phone without a person", () => {
    expect(view(session({ remote: "phone-guest" })).holder).toEqual({ kind: "someone" });
  });

  it("nobody (the remote phone went quiet)", () => {
    expect(view(session({ remote: null })).holder).toEqual({ kind: "nobody" });
    expect(view(null).holder).toEqual({ kind: "nobody" });
  });
});

describe("pickerDevices: the TVs the picker lists", () => {
  const living = { id: "living", name: "Living room TV", type: "chromecast" as const };
  const den = { id: "den", name: "Den", type: "chromecast" as const };

  it("the TV you're casting to comes first, then the others", () => {
    expect(pickerDevices([den, living], { id: "living", name: "Living room TV" })).toEqual([
      living,
      den,
    ]);
  });

  it("the current TV is listed even before discovery finds it again", () => {
    expect(pickerDevices([den], { id: "living", name: "Living room TV" })).toEqual([living, den]);
  });

  it("not casting: just what discovery found", () => {
    expect(pickerDevices([den, living], null)).toEqual([den, living]);
  });
});

describe("nowLine: the line under what's on the TV", () => {
  const home = (focus: string | null, paused: string | null) =>
    ({ kind: "home", focus, paused }) as const;
  it("Home, focus on a paused game: OK continues it (the TV says Continue)", () => {
    expect(nowLine(home("Rocket Crew", "Rocket Crew"))).toBe("OK continues Rocket Crew");
  });
  it("Home, focus on a game: OK opens it", () => {
    expect(nowLine(home("Bake Shop", "Rocket Crew"))).toBe("OK opens Bake Shop");
  });
  it("Home, nothing focused, a game paused", () => {
    expect(nowLine(home(null, "Rocket Crew"))).toBe("Rocket Crew is paused");
  });
  it("Home, nothing at all", () => {
    expect(nowLine(home(null, null))).toBe("Pick a game with the arrows");
  });
  it("a game's page: OK plays it (the TV's button says Play)", () => {
    expect(nowLine({ kind: "page", name: "Bake Shop", game: null })).toBe("Press OK to play");
  });
  it("a game: where you are in it, else Playing now", () => {
    expect(nowLine({ kind: "game", name: "R", game: null, detail: "Mission 6" })).toBe("Mission 6");
    expect(nowLine({ kind: "game", name: "R", game: null, detail: null })).toBe("Playing now");
  });
});
