import { remotePress } from "../remote";

describe("the TV tab's remote (spec v3, Messages: phone → session)", () => {
  it("the d-pad moves the TV's focus ring", () => {
    for (const dir of ["up", "down", "left", "right"] as const)
      expect(remotePress(dir, "phone-1")).toEqual({
        messages: [{ type: "focus.move", dir }],
        stopCast: false,
      });
  });

  it("OK selects, as this phone (so it hosts what starts)", () => {
    expect(remotePress("ok", "phone-1").messages).toEqual([
      { type: "select", deviceId: "phone-1" },
    ]);
  });

  it("Back and Home", () => {
    expect(remotePress("back", "p").messages).toEqual([{ type: "back" }]);
    expect(remotePress("home", "p").messages).toEqual([{ type: "home" }]);
  });

  it("End for tonight ends the session and stops casting", () => {
    expect(remotePress("end", "p")).toEqual({ messages: [{ type: "end" }], stopCast: true });
  });
});

describe("only End stops the cast", () => {
  it("OK, Back and Home keep casting", () => {
    for (const b of ["ok", "back", "home"] as const)
      expect(remotePress(b, "p").stopCast).toBe(false);
  });
});
