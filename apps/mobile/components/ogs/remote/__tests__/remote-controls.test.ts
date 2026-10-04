import { castControls } from "../remote-view";

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
