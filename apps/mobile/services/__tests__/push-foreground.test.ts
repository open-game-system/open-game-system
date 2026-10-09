import { foregroundDecision } from "../push-foreground";

const push = (over: Record<string, unknown> = {}) => ({
  type: "game-push",
  appId: "codebreakers",
  url: "https://cb.example/room/KQTP",
  whenOpen: "deliver",
  ...over,
});
const content = { title: "Your clue, Keyholder", body: "Moon is up." };

describe("a push arriving while the app is in front", () => {
  it("the game it is for is open and listening: no banner, the page gets it", () => {
    expect(
      foregroundDecision(
        { data: push(), ...content },
        { openAppId: "codebreakers", listening: true },
      ),
    ).toEqual({
      banner: false,
      toPage: {
        title: "Your clue, Keyholder",
        body: "Moon is up.",
        url: "https://cb.example/room/KQTP",
      },
    });
  });

  it("keeps the tag for the page", () => {
    const d = foregroundDecision(
      { data: push({ tag: "cb-KQTP" }), ...content },
      { openAppId: "codebreakers", listening: true },
    );
    expect(d.toPage).toMatchObject({ tag: "cb-KQTP" });
  });

  it("the game is open but registered no handler: banner", () => {
    expect(
      foregroundDecision(
        { data: push(), ...content },
        { openAppId: "codebreakers", listening: false },
      ),
    ).toEqual({
      banner: true,
      toPage: null,
    });
  });

  it("whenOpen banner: always a banner, never the page", () => {
    expect(
      foregroundDecision(
        { data: push({ whenOpen: "banner" }), ...content },
        { openAppId: "codebreakers", listening: true },
      ),
    ).toEqual({ banner: true, toPage: null });
  });

  it("another game is open, or none: banner", () => {
    expect(
      foregroundDecision(
        { data: push(), ...content },
        { openAppId: "rocket-crew", listening: true },
      ).banner,
    ).toBe(true);
    expect(
      foregroundDecision({ data: push(), ...content }, { openAppId: null, listening: false })
        .banner,
    ).toBe(true);
  });

  it("anything that isn't a game push (an invite) shows as before", () => {
    expect(
      foregroundDecision(
        { data: { type: "game-invite", url: "https://opengame.org/play/x?room=A" }, ...content },
        {
          openAppId: "codebreakers",
          listening: true,
        },
      ),
    ).toEqual({ banner: true, toPage: null });
    expect(
      foregroundDecision({ data: null, ...content }, { openAppId: null, listening: false }).banner,
    ).toBe(true);
  });

  it("missing title or body: the page gets empty strings, not undefined", () => {
    const d = foregroundDecision(
      { data: push(), title: null, body: null },
      { openAppId: "codebreakers", listening: true },
    );
    expect(d.toPage).toEqual({ title: "", body: "", url: "https://cb.example/room/KQTP" });
  });
});
