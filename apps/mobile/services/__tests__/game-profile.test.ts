import { createGameProfile, createGameTokenClient, type GameGrant } from "../game-profile";
import { OgsApiError } from "../ogs-api";

const NOW = 1_900_000_000_000;
const juneau = {
  id: "p_juneau",
  handle: "juneau",
  name: "Juneau",
  avatar: "https://tv.test/art/story-nook/char-dragon.webp",
};
const grant = (token: string, expiresAt = NOW + 60 * 60 * 1000): GameGrant => ({
  token,
  expiresAt,
  profile: juneau,
});
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe("the game WebView's profile store", () => {
  it("starts with nothing to give (no game open)", () => {
    const gp = createGameProfile({ fetchToken: jest.fn() });
    expect(gp.store.getSnapshot()).toEqual({ status: "none" });
  });

  it("asks for the game's token when a game opens, then gives the game the profile", async () => {
    const fetchToken = jest.fn(async () => grant("t1"));
    const gp = createGameProfile({ fetchToken });
    const seen: unknown[] = [];
    gp.store.subscribe((s) => seen.push(s));
    gp.open("rocket-crew");
    expect(gp.store.getSnapshot()).toEqual({ status: "asking" });
    await flush();
    expect(fetchToken).toHaveBeenCalledWith("rocket-crew");
    expect(gp.store.getSnapshot()).toEqual({
      status: "ready",
      profile: { ...juneau, token: "t1" },
    });
    expect(seen).toEqual([
      { status: "asking" },
      { status: "ready", profile: { ...juneau, token: "t1" } },
    ]);
  });

  it("refreshes the token 5 minutes before it expires", async () => {
    const fetchToken = jest
      .fn<Promise<GameGrant>, [string]>()
      .mockResolvedValueOnce(grant("t1"))
      .mockResolvedValueOnce(grant("t2", NOW + 2 * 60 * 60 * 1000));
    const gp = createGameProfile({ fetchToken });
    gp.open("rocket-crew");
    await flush();
    jest.advanceTimersByTime(55 * 60 * 1000 - 1);
    expect(fetchToken).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(fetchToken).toHaveBeenCalledTimes(2);
    expect(gp.store.getSnapshot()).toEqual({
      status: "ready",
      profile: { ...juneau, token: "t2" },
    });
  });

  it("a failed refresh keeps the current token and tries again in a minute", async () => {
    const fetchToken = jest
      .fn<Promise<GameGrant>, [string]>()
      .mockResolvedValueOnce(grant("t1"))
      .mockRejectedValueOnce(new OgsApiError("OFFLINE", "offline", 0))
      .mockResolvedValueOnce(grant("t3"));
    const gp = createGameProfile({ fetchToken });
    gp.open("rocket-crew");
    await flush();
    jest.advanceTimersByTime(55 * 60 * 1000);
    await flush();
    expect(gp.store.getSnapshot()).toEqual({
      status: "ready",
      profile: { ...juneau, token: "t1" },
    });
    jest.advanceTimersByTime(60 * 1000);
    await flush();
    expect(gp.store.getSnapshot()).toEqual({
      status: "ready",
      profile: { ...juneau, token: "t3" },
    });
  });

  it("a game OGS doesn't know (or no profile, or offline) gets none, so it shows its own form", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const gp = createGameProfile({
      fetchToken: jest.fn(async () => {
        throw new OgsApiError("game_not_found", "No game", 404);
      }),
    });
    gp.open("not-a-game");
    await flush();
    expect(gp.store.getSnapshot()).toEqual({ status: "none" });
    warn.mockRestore();
  });

  it("an unknown game (no appId) gets none without asking", () => {
    const fetchToken = jest.fn();
    const gp = createGameProfile({ fetchToken });
    gp.open(null);
    expect(gp.store.getSnapshot()).toEqual({ status: "none" });
    expect(fetchToken).not.toHaveBeenCalled();
  });

  it("closing the game drops the token and stops refreshing", async () => {
    const fetchToken = jest.fn(async () => grant("t1"));
    const gp = createGameProfile({ fetchToken });
    gp.open("rocket-crew");
    await flush();
    gp.close();
    expect(gp.store.getSnapshot()).toEqual({ status: "none" });
    jest.advanceTimersByTime(2 * 60 * 60 * 1000);
    await flush();
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("a slow answer for the previous game never lands on the next one", async () => {
    let resolveFirst: (g: GameGrant) => void = () => {};
    const fetchToken = jest
      .fn<Promise<GameGrant>, [string]>()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(grant("story"));
    const gp = createGameProfile({ fetchToken });
    gp.open("rocket-crew");
    gp.open("story-nook");
    await flush();
    resolveFirst(grant("rocket"));
    await flush();
    expect(gp.store.getSnapshot()).toEqual({
      status: "ready",
      profile: { ...juneau, token: "story" },
    });
  });

  it("reopening the same game keeps its token (no second ask)", async () => {
    const fetchToken = jest.fn(async () => grant("t1"));
    const gp = createGameProfile({ fetchToken });
    gp.open("rocket-crew");
    await flush();
    gp.open("rocket-crew");
    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(gp.store.getSnapshot()).toEqual({
      status: "ready",
      profile: { ...juneau, token: "t1" },
    });
  });

  it("is a bridge store: unsubscribe, reset, and a page's REFRESH does nothing harmful", async () => {
    const gp = createGameProfile({ fetchToken: jest.fn(async () => grant("t1")) });
    const listener = jest.fn();
    gp.store.subscribe(listener)();
    gp.open("rocket-crew");
    await flush();
    expect(listener).not.toHaveBeenCalled();
    gp.store.dispatch({ type: "REFRESH" });
    expect(gp.store.on("REFRESH", () => {})).toEqual(expect.any(Function));
    gp.store.reset();
    expect(gp.store.getSnapshot()).toEqual({ status: "none" });
  });
});

describe("POST /games/:appId/token client", () => {
  it("asks with the profile token and parses the grant", async () => {
    const fetch = jest.fn(async () =>
      Response.json({ token: "t1", expiresAt: NOW + 1000, profile: juneau }),
    );
    const client = createGameTokenClient({
      baseUrl: "http://api.test",
      fetch,
      auth: () => ({ token: "profile-token" }),
    });
    expect(await client("rocket crew")).toEqual(grant("t1", NOW + 1000));
    expect(fetch).toHaveBeenCalledWith(
      "http://api.test/api/v1/games/rocket%20crew/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer profile-token" }),
      }),
    );
  });

  it("a malformed answer is a BAD_RESPONSE", async () => {
    const client = createGameTokenClient({
      baseUrl: "http://api.test",
      fetch: async () => Response.json({ token: "" }),
      auth: () => ({ token: "p" }),
    });
    await expect(client("rocket-crew")).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });
});
