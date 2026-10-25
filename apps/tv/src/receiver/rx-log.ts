/** The production OGS API: where receiver events go when no sender named one in 15 s. */
export const DEFAULT_API = "https://opengame-api.jonathanrmumm.workers.dev";

const BATCH = 50;
const KEEP = 200;
const FLUSH_MS = 3000;
const HOLD_FOR_API_MS = 15_000;

type Scalar = string | number | boolean | null;
type Level = "debug" | "info" | "warn" | "error";
export interface RxFields {
  level?: Level;
  error?: unknown;
  durationMs?: number;
  data?: Record<string, Scalar>;
  /** Send now (the cast is ending, or an error). */
  now?: boolean;
}

interface RxEvent {
  name: string;
  at: number;
  level: Level;
  attemptId: string;
  phoneAttemptId?: string;
  sessionId?: string;
  error?: string;
  durationMs?: number;
  data?: Record<string, Scalar>;
}

const joinId = (v: unknown) =>
  typeof v === "string" && v.length > 0 && v.length <= 64 ? v : undefined;
const message = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 1000);

function eventOf(name: string, f: RxFields, run: string): RxEvent {
  const e: RxEvent = {
    name: `receiver.${name}`,
    at: Date.now(),
    level: f.level ?? (f.error !== undefined ? "error" : "info"),
    attemptId: run,
  };
  if (f.error !== undefined) e.error = message(f.error);
  if (f.durationMs !== undefined) e.durationMs = Math.max(0, Math.round(f.durationMs));
  if (f.data) e.data = f.data;
  return e;
}

/**
 * The receiver's client log: `receiver.<name>` wide events to POST /api/v1/client-events on the
 * launcher's API (the client-log pipeline, docs/agents/client-log.md), with no credentials (the API
 * stores them under receiver:<couch session>). Batched every 3 s; held until a LOAD_VIEW names the
 * API (or 15 s, then the production API). Never a URL with a token: callers log hosts only.
 */
export function createRxLog(opts: {
  post: (url: string, body: string) => void;
  run: string;
  version: string;
  platform: string;
}) {
  let events: RxEvent[] = [];
  let api: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const started = Date.now();
  const join: { phoneAttemptId?: string; sessionId?: string } = {};

  const schedule = () => {
    if (!timer) timer = setTimeout(tick, FLUSH_MS);
  };
  const tick = () => {
    timer = null;
    if (api || Date.now() - started >= HOLD_FOR_API_MS) flush();
    else schedule();
  };
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const base = api ?? DEFAULT_API;
    while (events.length) {
      const batch = events.splice(0, BATCH);
      const body = JSON.stringify({
        context: { app: "receiver", version: opts.version, platform: opts.platform },
        events: batch.map((e) => ({ ...e, ...join })),
      });
      try {
        opts.post(`${base}/api/v1/client-events`, body);
      } catch {
        /* logs are best effort */
      }
    }
  };

  return {
    event(name: string, f: RxFields = {}) {
      events.push(eventOf(name, f, opts.run));
      if (events.length > KEEP) events = events.slice(-KEEP);
      if (f.now && api) flush();
      else schedule();
    },
    setApi(next: string) {
      api = next.replace(/\/+$/, "");
    },
    join(ids: { phoneAttemptId?: unknown; sessionId?: unknown }) {
      const a = joinId(ids.phoneAttemptId);
      const s = joinId(ids.sessionId);
      if (a) join.phoneAttemptId = a;
      else delete join.phoneAttemptId;
      if (s) join.sessionId = s;
      else delete join.sessionId;
    },
    flush,
  };
}

export type RxLog = ReturnType<typeof createRxLog>;
