import type { CastSessionRow } from "./types";

const IDLE_THRESHOLD_MINUTES = 30;
const ENDED_THRESHOLD_MINUTES = 5;

/**
 * Narrow DB interface — only the methods handleScheduled actually uses.
 * This avoids requiring tests to mock the full D1Database surface.
 */
interface ScheduledDB {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean }>;
    };
  };
}

/**
 * Narrow DO namespace interface for scheduled handler.
 */
interface ScheduledDONamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): {
    fetch(request: Request): Promise<Response>;
  };
}

export interface ScheduledEnv {
  DB: ScheduledDB;
  STREAM_CONTAINER: ScheduledDONamespace;
}

/**
 * Handles the Cloudflare scheduled (cron) trigger.
 *
 * 1. Active sessions with no state update for 30+ minutes -> marked 'idle'
 * 2. Idle sessions with no update for 5+ minutes -> marked 'ended' + stream container DO torn down
 */
export async function handleScheduled(env: ScheduledEnv): Promise<void> {
  // Step 1: Mark stale active sessions as idle
  const activeThreshold = new Date(Date.now() - IDLE_THRESHOLD_MINUTES * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "")
    .slice(0, 19);

  const staleActive = await env.DB.prepare(
    "SELECT session_id, stream_session_id FROM cast_sessions WHERE status = 'active' AND updated_at <= ?",
  )
    .bind(activeThreshold)
    .all<Pick<CastSessionRow, "session_id" | "stream_session_id">>();

  for (const session of staleActive.results) {
    await env.DB.prepare(
      "UPDATE cast_sessions SET status = 'idle', updated_at = datetime('now') WHERE session_id = ?",
    )
      .bind(session.session_id)
      .run();
  }

  // Step 2: End idle sessions past the grace period
  const idleThreshold = new Date(Date.now() - ENDED_THRESHOLD_MINUTES * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "")
    .slice(0, 19);

  const staleIdle = await env.DB.prepare(
    "SELECT session_id, stream_session_id FROM cast_sessions WHERE status = 'idle' AND updated_at <= ?",
  )
    .bind(idleThreshold)
    .all<Pick<CastSessionRow, "session_id" | "stream_session_id">>();

  for (const session of staleIdle.results) {
    // Tear down stream container via DO (best effort)
    if (session.stream_session_id) {
      try {
        const doId = env.STREAM_CONTAINER.idFromName(`session-${session.session_id}`);
        const stub = env.STREAM_CONTAINER.get(doId);

        await stub.fetch(new Request(`https://stream-container/sessions/${session.stream_session_id}`, {
          method: "DELETE",
        }));
      } catch {
        // Best effort — session ends regardless of teardown success
      }
    }

    await env.DB.prepare(
      "UPDATE cast_sessions SET status = 'ended', updated_at = datetime('now') WHERE session_id = ?",
    )
      .bind(session.session_id)
      .run();
  }
}
