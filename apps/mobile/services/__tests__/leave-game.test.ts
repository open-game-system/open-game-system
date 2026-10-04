import { leaveGame } from "../leave-game";

const base = {
  appId: "rocket-crew",
  name: "Rocket Crew",
  url: "https://rc.example/room/AB",
  now: 5000,
};

describe("leaving a game (a completed swipe back)", () => {
  it("cast: sends home so the launcher pauses the game on the TV", () => {
    expect(leaveGame({ ...base, ogsCast: true, reported: true }).home).toBe(true);
  });

  it("not cast: sends nothing to the session", () => {
    expect(leaveGame({ ...base, ogsCast: false, reported: true }).home).toBe(false);
  });

  it("a game that reported its own instance gets no visit record", () => {
    expect(leaveGame({ ...base, ogsCast: false, reported: true }).visit).toBeNull();
  });

  it("a game that reported nothing is recorded as a suspended visit (one Continue per game)", () => {
    expect(leaveGame({ ...base, ogsCast: false, reported: false }).visit).toEqual({
      instanceId: "visit-rocket-crew",
      appId: "rocket-crew",
      status: "suspended",
      title: "Rocket Crew",
      detail: "",
      resumeUrl: "https://rc.example/room/AB",
    });
  });

  it("a known sitting is recorded under its own id, so two games of one title stay two", () => {
    const out = leaveGame({
      ...base,
      ogsCast: true,
      reported: false,
      instanceId: "rocket-crew-abc",
    });
    expect(out.visit?.instanceId).toBe("rocket-crew-abc");
  });

  it("the return pill remembers the sitting it points back into", () => {
    const out = leaveGame({
      ...base,
      ogsCast: false,
      reported: true,
      instanceId: "rocket-crew-abc",
    });
    expect(out.pill.instanceId).toBe("rocket-crew-abc");
  });

  it("without a known game there is nothing to record", () => {
    expect(leaveGame({ ...base, appId: null, ogsCast: false, reported: false }).visit).toBeNull();
  });

  it("leaves a return pill pointing back into the game", () => {
    expect(leaveGame({ ...base, ogsCast: true, reported: true }).pill).toEqual({
      appId: "rocket-crew",
      name: "Rocket Crew",
      url: "https://rc.example/room/AB",
      at: 5000,
    });
  });

  it("a non-http URL is not a resume point", () => {
    expect(
      leaveGame({ ...base, url: "about:blank", ogsCast: false, reported: false }).visit,
    ).toMatchObject({ resumeUrl: undefined });
  });
});
