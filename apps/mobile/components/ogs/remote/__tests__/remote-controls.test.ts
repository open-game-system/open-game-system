import { castControls, tvHeroName, tvNameNow } from "../remote-view";

const host = { id: "p-mom", handle: "mom", name: "Mom", sticker: "whale" };
const session = (role: "host" | "member") => ({
  sessionId: "s1",
  code: "KQ7M2X",
  tvName: "Living room TV",
  host,
  role,
});

describe("castControls: the caster stops casting; a phone that joined leaves the host's TV", () => {
  it("the caster: Stop casting with a confirm, and Change TV", () => {
    const c = castControls({
      session: session("host"),
      castDeviceName: "Bedroom TV",
      gameName: "Rocket Crew",
    });
    expect(c).toEqual({
      role: "host",
      tvName: "Bedroom TV",
      changeTv: true,
      end: {
        label: "Stop casting",
        title: "Stop casting?",
        body: "Bedroom TV goes back to its own screen. Rocket Crew keeps its place: cast again to pick it back up.",
        confirm: "Stop casting",
        keep: "Keep casting",
      },
    });
  });

  it("the caster with no game held: cast again any time", () => {
    const c = castControls({ session: null, castDeviceName: "Living room TV", gameName: null });
    expect(c.role).toBe("host");
    expect(c.end.body).toBe(
      "Living room TV goes back to its own screen. Cast again any time from this tab.",
    );
  });

  it("no TV name anywhere: 'the TV'", () => {
    expect(castControls({ session: null, castDeviceName: null, gameName: null }).tvName).toBe(
      "the TV",
    );
  });

  it("a phone that joined: Leave <host>'s TV, never Stop casting, no Change TV", () => {
    const c = castControls({
      session: session("member"),
      castDeviceName: null,
      gameName: "Rocket Crew",
    });
    expect(c).toEqual({
      role: "member",
      tvName: "Living room TV",
      changeTv: false,
      end: {
        label: "Leave Mom's TV",
        title: "Leave Mom's TV?",
        body: "The TV keeps playing for everyone on Mom's couch. To come back, type the code on the TV.",
        confirm: "Leave",
        keep: "Stay",
      },
    });
    expect(JSON.stringify(c)).not.toMatch(/Stop casting/);
  });

  it("a phone that joined names the host's TV, not a cast device of its own", () => {
    expect(
      castControls({ session: session("member"), castDeviceName: "Bedroom TV", gameName: null })
        .tvName,
    ).toBe("Living room TV");
  });
});

// Owner, 2026-10-06 (real iPhone, two Chromecasts): after Change TV the TV tab's hero kept the old
// TV's name, and nothing said a switch was under way.
describe("the TV's name after Change TV (the couch session's tvName)", () => {
  it("a phone that joined names the TV the cast moved to", () => {
    expect(
      castControls({
        session: session("member"),
        castDeviceName: null,
        couchTvName: "Bedroom TV",
        gameName: null,
      }).tvName,
    ).toBe("Bedroom TV");
  });

  it("the caster: the Cast device first, else the moved-to TV, else the created name", () => {
    const named = (castDeviceName: string | null, couchTvName?: string) =>
      castControls({ session: session("host"), castDeviceName, couchTvName, gameName: null })
        .tvName;
    expect(named("Den TV", "Bedroom TV")).toBe("Den TV");
    expect(named(null, "Bedroom TV")).toBe("Bedroom TV");
    expect(named(null)).toBe("Living room TV");
  });

  it("the Playing tab's strip: the same name, and none while not cast", () => {
    const base = {
      castDeviceName: null,
      couchTvName: "Bedroom TV",
      sessionTvName: "Living room TV",
    };
    expect(tvNameNow({ ...base, cast: true })).toBe("Bedroom TV");
    expect(tvNameNow({ ...base, cast: true, castDeviceName: "Den TV" })).toBe("Den TV");
    expect(tvNameNow({ ...base, cast: true, couchTvName: undefined })).toBe("Living room TV");
    expect(
      tvNameNow({ cast: true, castDeviceName: null, couchTvName: undefined, sessionTvName: null }),
    ).toBeNull();
    expect(tvNameNow({ ...base, cast: false })).toBeNull();
  });
});

describe("the TV tab's hero while a switch runs", () => {
  it("says which TV it is switching to, then names the TV it is on", () => {
    expect(
      tvHeroName("Living room TV", { status: "switching", tv: { id: "b", name: "Bedroom TV" } }),
    ).toBe("Switching to Bedroom TV…");
    expect(tvHeroName("Bedroom TV", { status: "idle" })).toBe("Bedroom TV");
  });

  it("a failed switch names the TV it is on (the error says the rest)", () => {
    expect(
      tvHeroName("Living room TV", {
        status: "failed",
        tv: { id: "b", name: "Bedroom TV" },
        reason: "no-tv",
      }),
    ).toBe("Living room TV");
  });
});
