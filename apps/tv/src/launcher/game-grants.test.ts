import { describe, expect, it, vi } from "vitest";
import { createGameGrants } from "./game-grants";

describe("session game grants", () => {
  const players = [
    { id: "p1", handle: "jonathan.m", name: "Jonathan", avatar: "https://tv.test/a.webp" },
  ];
  const ok = (body: unknown) =>
    vi.fn(async (_url: string, _init?: RequestInit) => Response.json(body));

  it("asks POST /sessions/:sid/game-token with the launcher token", async () => {
    const fetch = ok({ token: "g", players, expiresAt: 5 });
    const grants = createGameGrants({
      api: "https://api.test",
      token: "L",
      sessionId: "s 1",
      fetch,
    });
    expect(await grants("rocket-crew")).toEqual({ token: "g", players, expiresAt: 5 });
    expect(fetch).toHaveBeenCalledWith("https://api.test/api/v1/sessions/s%201/game-token", {
      method: "POST",
      headers: { Authorization: "Bearer L", "Content-Type": "application/json" },
      body: JSON.stringify({ appId: "rocket-crew" }),
    });
  });

  it("caches a grant until 5 minutes before it expires", async () => {
    let now = 0;
    const fetch = ok({ token: "g", players, expiresAt: 60 * 60 * 1000 });
    const grants = createGameGrants({
      api: "a",
      token: "L",
      sessionId: "s",
      fetch,
      now: () => now,
    });
    await grants("rocket-crew");
    now = 55 * 60 * 1000 - 1;
    await grants("rocket-crew");
    expect(fetch).toHaveBeenCalledTimes(1);
    now = 55 * 60 * 1000;
    await grants("rocket-crew");
    expect(fetch).toHaveBeenCalledTimes(2);
    await grants("story-nook");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("a failed or malformed answer is no grant (and is asked again next time)", async () => {
    const fetch = vi
      .fn(async (_url: string, _init?: RequestInit) => new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ token: 1 }))
      .mockRejectedValueOnce(new Error("offline"));
    const grants = createGameGrants({ api: "a", token: "L", sessionId: "s", fetch });
    expect(await grants("rocket-crew")).toBeNull();
    expect(await grants("rocket-crew")).toBeNull();
    expect(await grants("rocket-crew")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
