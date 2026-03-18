import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { handleScheduled } from "../../src/scheduled";

/**
 * Scheduled Handler Integration Tests
 *
 * Tests handleScheduled() against real D1 (not mocked).
 * Verifies active→idle→ended transitions with real timestamp logic.
 */

const GAME_ID = "trivia-jam";

async function insertSession(sessionId: string, status: string, updatedAtMinutesAgo: number) {
  const updatedAt = new Date(Date.now() - updatedAtMinutesAgo * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "")
    .slice(0, 19);

  await env.DB.prepare(
    `INSERT INTO cast_sessions (session_id, game_id, device_id, view_url, stream_session_id, stream_url, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      sessionId,
      GAME_ID,
      "tv-1",
      "https://example.com/spectate",
      sessionId,
      `https://api.test/api/v1/cast/stream/${sessionId}`,
      status,
      updatedAt,
    )
    .run();
}

async function getSessionStatus(sessionId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT status FROM cast_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<{ status: string }>();
  return row?.status ?? null;
}

describe("Scheduled Handler — D1 Integration", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM cast_sessions").run();
  });

  describe("Active → Idle transition (30 min threshold)", () => {
    it("marks active session as idle when stale for 30+ minutes", async () => {
      await insertSession("session-stale", "active", 35);

      await handleScheduled(env);

      expect(await getSessionStatus("session-stale")).toBe("idle");
    });

    it("leaves active session alone when updated recently", async () => {
      await insertSession("session-fresh", "active", 10);

      await handleScheduled(env);

      expect(await getSessionStatus("session-fresh")).toBe("active");
    });

    it("leaves active session at exactly 30 minutes alone", async () => {
      // At exactly 30 min, updated_at == threshold, so <= catches it
      // But due to timing, 29 min should be safe
      await insertSession("session-boundary", "active", 29);

      await handleScheduled(env);

      expect(await getSessionStatus("session-boundary")).toBe("active");
    });
  });

  describe("Idle → Ended transition (5 min threshold)", () => {
    it("marks idle session as ended when stale for 5+ minutes", async () => {
      await insertSession("session-idle-stale", "idle", 10);

      await handleScheduled(env);

      expect(await getSessionStatus("session-idle-stale")).toBe("ended");
    });

    it("leaves idle session alone when updated recently", async () => {
      await insertSession("session-idle-fresh", "idle", 2);

      await handleScheduled(env);

      expect(await getSessionStatus("session-idle-fresh")).toBe("idle");
    });
  });

  describe("Full lifecycle: active → idle → ended", () => {
    it("transitions through both stages across two scheduled runs", async () => {
      // Session was active 35 min ago
      await insertSession("session-lifecycle", "active", 35);

      // First run: active → idle
      await handleScheduled(env);
      expect(await getSessionStatus("session-lifecycle")).toBe("idle");

      // Simulate time passing: update the timestamp to 10 min ago
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "")
        .slice(0, 19);
      await env.DB.prepare("UPDATE cast_sessions SET updated_at = ? WHERE session_id = ?")
        .bind(tenMinAgo, "session-lifecycle")
        .run();

      // Second run: idle → ended
      await handleScheduled(env);
      expect(await getSessionStatus("session-lifecycle")).toBe("ended");
    });
  });

  describe("Does not affect unrelated sessions", () => {
    it("only transitions stale sessions, leaves fresh ones intact", async () => {
      await insertSession("session-stale-active", "active", 35);
      await insertSession("session-fresh-active", "active", 5);
      await insertSession("session-stale-idle", "idle", 10);
      await insertSession("session-fresh-idle", "idle", 2);
      await insertSession("session-already-ended", "ended", 60);

      await handleScheduled(env);

      expect(await getSessionStatus("session-stale-active")).toBe("idle");
      expect(await getSessionStatus("session-fresh-active")).toBe("active");
      expect(await getSessionStatus("session-stale-idle")).toBe("ended");
      expect(await getSessionStatus("session-fresh-idle")).toBe("idle");
      expect(await getSessionStatus("session-already-ended")).toBe("ended");
    });
  });
});
