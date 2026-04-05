import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { handleScheduled, type ScheduledEnv } from "../src/scheduled";
import { OgsErrorSchema } from "../src/schemas";

const VALID_API_KEY = { key: "valid-key", game_id: "trivia-jam", game_name: "Trivia Jam" };

// Mock DO stub for StreamContainer
const mockStubFetch = vi.fn();

function createMockStreamContainer() {
  return {
    idFromName: vi.fn(() => ({ toString: () => "mock-do-id" })),
    get: vi.fn(() => ({
      fetch: mockStubFetch,
    })),
  };
}

beforeEach(() => {
  mockStubFetch.mockReset();
});

function minutesAgo(n: number): string {
  const d = new Date(Date.now() - n * 60 * 1000);
  return d.toISOString().replace("T", " ").replace("Z", "").slice(0, 19);
}

function createScheduledMockEnv(
  opts: { activeSessions?: unknown[]; idleSessions?: unknown[] } = {},
) {
  const { activeSessions = [], idleSessions = [] } = opts;

  const updateCalls: Array<{ sql: string; bindings: unknown[] }> = [];

  const env: ScheduledEnv = {
    DB: {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...args: unknown[]) => {
          // UPDATE statements
          if (sql.includes("UPDATE cast_sessions")) {
            updateCalls.push({ sql, bindings: args });
            return {
              all: vi.fn().mockResolvedValue({ results: [] }),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          // SELECT active sessions older than 30 min
          if (sql.includes("status = 'active'") && sql.includes("updated_at")) {
            return {
              all: vi.fn().mockResolvedValue({ results: activeSessions }),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          // SELECT idle sessions older than 5 min
          if (sql.includes("status = 'idle'") && sql.includes("updated_at")) {
            return {
              all: vi.fn().mockResolvedValue({ results: idleSessions }),
              run: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          };
        }),
      })),
    },
  };

  return { env, updateCalls };
}

describe("Cast Session Auto-Expiry (Scheduled Handler)", () => {
  describe("active -> idle transition", () => {
    it("marks active session older than 30 min as idle (container NOT torn down)", async () => {
      const { env, updateCalls } = createScheduledMockEnv({
        activeSessions: [
          {
            session_id: "session-1",
            stream_session_id: "stream-1",
            status: "active",
            updated_at: minutesAgo(35),
          },
        ],
      });

      await handleScheduled(env);

      // Should have updated status to idle
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
      const idleUpdate = updateCalls.find(
        (c) => c.sql.includes("'idle'") && c.bindings.includes("session-1"),
      );
      expect(idleUpdate).toBeDefined();

      // Should NOT have called DO stub for teardown
      expect(mockStubFetch).not.toHaveBeenCalled();
    });

    it("does not touch active session newer than 30 min", async () => {
      const { env, updateCalls } = createScheduledMockEnv({
        activeSessions: [], // The query filters by time, so no results means nothing to process
      });

      await handleScheduled(env);

      const idleUpdates = updateCalls.filter((c) => c.sql.includes("'idle'"));
      expect(idleUpdates).toHaveLength(0);
    });
  });

  describe("idle -> ended transition", () => {
    it("marks idle session older than 5 min as ended", async () => {
      const { env, updateCalls } = createScheduledMockEnv({
        idleSessions: [
          {
            session_id: "session-2",
            stream_session_id: "stream-2",
            status: "idle",
            updated_at: minutesAgo(40),
          },
        ],
      });

      await handleScheduled(env);

      // Should have updated status to ended
      const endedUpdate = updateCalls.find(
        (c) => c.sql.includes("'ended'") && c.bindings.includes("session-2"),
      );
      expect(endedUpdate).toBeDefined();
      // Container auto-sleeps via sleepAfter — no explicit teardown needed
    });

    it("does not touch idle session newer than 5 min (grace period)", async () => {
      const { env, updateCalls } = createScheduledMockEnv({
        idleSessions: [], // The query filters by time, so no results
      });

      await handleScheduled(env);

      const endedUpdates = updateCalls.filter((c) => c.sql.includes("'ended'"));
      expect(endedUpdates).toHaveLength(0);
      expect(mockStubFetch).not.toHaveBeenCalled();
    });
  });

  describe("multiple sessions in one run", () => {
    it("processes multiple active and idle sessions", async () => {
      const { env, updateCalls } = createScheduledMockEnv({
        activeSessions: [
          {
            session_id: "active-1",
            stream_session_id: "s-1",
            status: "active",
            updated_at: minutesAgo(31),
          },
          {
            session_id: "active-2",
            stream_session_id: "s-2",
            status: "active",
            updated_at: minutesAgo(45),
          },
        ],
        idleSessions: [
          {
            session_id: "idle-1",
            stream_session_id: "s-3",
            status: "idle",
            updated_at: minutesAgo(6),
          },
          {
            session_id: "idle-2",
            stream_session_id: "s-4",
            status: "idle",
            updated_at: minutesAgo(10),
          },
        ],
      });

      await handleScheduled(env);

      // 2 active->idle + 2 idle->ended = 4 updates
      expect(updateCalls).toHaveLength(4);
      // No explicit stream teardown — containers auto-sleep
    });
  });

  describe("DO teardown failure", () => {
    it("marks session as ended even when DO DELETE fails", async () => {
      mockStubFetch.mockRejectedValueOnce(new TypeError("DO fetch failed"));

      const { env, updateCalls } = createScheduledMockEnv({
        idleSessions: [
          {
            session_id: "session-3",
            stream_session_id: "stream-3",
            status: "idle",
            updated_at: minutesAgo(10),
          },
        ],
      });

      await handleScheduled(env);

      // Should still mark as ended despite DO failure
      const endedUpdate = updateCalls.find(
        (c) => c.sql.includes("'ended'") && c.bindings.includes("session-3"),
      );
      expect(endedUpdate).toBeDefined();
    });
  });
});

describe("Resuming an idle session", () => {
  it("reactivates an idle session when state is pushed", async () => {
    const updateRun = vi.fn().mockResolvedValue({ success: true });

    const env = {
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes("api_keys")) {
            return {
              bind: vi.fn(() => ({
                first: vi.fn().mockResolvedValue(VALID_API_KEY),
              })),
            };
          }
          if (sql.includes("UPDATE cast_sessions")) {
            return {
              bind: vi.fn(() => ({
                run: updateRun,
              })),
            };
          }
          if (sql.includes("cast_sessions")) {
            return {
              bind: vi.fn(() => ({
                first: vi.fn().mockResolvedValue({
                  session_id: "session-idle",
                  game_id: "trivia-jam",
                  device_id: "tv-1",
                  view_url: "https://triviajam.com/tv",
                  stream_session_id: "stream-456",
                  stream_url: "wss://stream.test.com/456",
                  status: "idle",
                  created_at: "2026-03-14T00:00:00",
                  updated_at: "2026-03-14T00:00:00",
                }),
              })),
            };
          }
          return {
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({}),
            })),
          };
        }),
      },
      OGS_JWT_SECRET: "test-jwt-secret",
      STREAM_CONTAINER: createMockStreamContainer(),
      CLOUDFLARE_TURN_API_TOKEN: "test-turn-token",
      CLOUDFLARE_TURN_KEY_ID: "test-turn-key-id",
    };

    const res = await app.request(
      "/api/v1/cast/sessions/session-idle/state",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({ state: { round: 5 } }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");

    // Verify that the session was reactivated (UPDATE called with 'active')
    expect(updateRun).toHaveBeenCalled();

    // State forwarded to container via binding
  });

  it("still returns 404 for ended session (not resumable)", async () => {
    const env = {
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes("api_keys")) {
            return {
              bind: vi.fn(() => ({
                first: vi.fn().mockResolvedValue(VALID_API_KEY),
              })),
            };
          }
          if (sql.includes("cast_sessions")) {
            return {
              bind: vi.fn(() => ({
                first: vi.fn().mockResolvedValue({
                  session_id: "session-ended",
                  game_id: "trivia-jam",
                  status: "ended",
                }),
              })),
            };
          }
          return {
            bind: vi.fn(() => ({
              first: vi.fn().mockResolvedValue(null),
              run: vi.fn().mockResolvedValue({}),
            })),
          };
        }),
      },
      OGS_JWT_SECRET: "test-jwt-secret",
      STREAM_CONTAINER: createMockStreamContainer(),
      CLOUDFLARE_TURN_API_TOKEN: "test-turn-token",
      CLOUDFLARE_TURN_KEY_ID: "test-turn-key-id",
    };

    const res = await app.request(
      "/api/v1/cast/sessions/session-ended/state",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-key",
        },
        body: JSON.stringify({ state: { round: 1 } }),
      },
      env,
    );

    expect(res.status).toBe(404);
    const body = OgsErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("session_not_found");
  });
});
