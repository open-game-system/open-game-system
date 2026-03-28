import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * Cross-Game Isolation Integration Tests
 *
 * Verifies that cast sessions are scoped to the API key's game_id.
 * Game A's sessions must be invisible and inaccessible to Game B.
 */

const GAME_A_KEY = "test-api-key"; // seeded in setup.ts — game_id: "trivia-jam"
const GAME_B_KEY = "game-b-api-key";

function headersFor(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

async function createSession(apiKey: string, deviceId: string): Promise<{ sessionId: string }> {
  const res = await SELF.fetch("https://api.test/api/v1/cast/sessions", {
    method: "POST",
    headers: headersFor(apiKey),
    body: JSON.stringify({
      deviceId,
      viewUrl: "https://example.com/spectate/game",
    }),
  });
  return (await res.json()) as { sessionId: string };
}

describe("Cross-Game Isolation — D1 Integration", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM cast_sessions").run();

    // Seed a second game's API key
    await env.DB.prepare(
      "INSERT OR IGNORE INTO api_keys (key, game_id, game_name) VALUES (?, ?, ?)",
    )
      .bind(GAME_B_KEY, "word-clash", "Word Clash")
      .run();
  });

  it("game A cannot read game B's session", async () => {
    const { sessionId } = await createSession(GAME_B_KEY, "tv-b");

    // Game A tries to GET game B's session
    const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionId}`, {
      headers: headersFor(GAME_A_KEY),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("session_not_found");
  });

  it("game A cannot delete game B's session", async () => {
    const { sessionId } = await createSession(GAME_B_KEY, "tv-b");

    // Game A tries to DELETE game B's session
    const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionId}`, {
      method: "DELETE",
      headers: headersFor(GAME_A_KEY),
    });

    expect(res.status).toBe(404);

    // Verify session is still active in D1
    const row = await env.DB.prepare("SELECT status FROM cast_sessions WHERE session_id = ?")
      .bind(sessionId)
      .first<{ status: string }>();

    expect(row?.status).toBe("active");
  });

  it("game A cannot push state to game B's session", async () => {
    const { sessionId } = await createSession(GAME_B_KEY, "tv-b");

    // Game A tries to push state to game B's session
    const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionId}/state`, {
      method: "POST",
      headers: headersFor(GAME_A_KEY),
      body: JSON.stringify({ state: { hijacked: true } }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("session_not_found");
  });

  it("each game sees only its own sessions", async () => {
    await createSession(GAME_A_KEY, "tv-a");
    const { sessionId: sessionB } = await createSession(GAME_B_KEY, "tv-b");

    // Game A reads session B → 404
    const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionB}`, {
      headers: headersFor(GAME_A_KEY),
    });

    expect(res.status).toBe(404);
  });

  it("game can read its own session after creation", async () => {
    const { sessionId } = await createSession(GAME_A_KEY, "tv-a");

    const res = await SELF.fetch(`https://api.test/api/v1/cast/sessions/${sessionId}`, {
      headers: headersFor(GAME_A_KEY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessionId: string; status: string };
    expect(body.sessionId).toBe(sessionId);
    expect(body.status).toBe("active");
  });
});
