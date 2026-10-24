/**
 * The stored client log (docs/agents/client-log.md): the last events of each app launch, kept so
 * an agent can read a device's log back after the fact (GET /api/v1/client-events with the log
 * key). One ClientLog Durable Object per bucket (`launch:<launchId>`, or `profile:<id>` /
 * `receiver:<session>` for builds that send no launch id) holds its events as the same JSON lines
 * Workers Logs gets; one more, "index", lists recent buckets. Everything expires TTL_MS after its
 * last write. Pure helpers here; the Durable Object is src/client-log-do.ts.
 */
export const MAX_EVENTS_PER_BUCKET = 500;
export const MAX_BUCKETS = 200;
export const TTL_MS = 7 * 24 * 3600_000;
export const INDEX_NAME = "index";

export type BucketSummary = {
  bucket: string;
  /** The context's app: "mobile", "shell" or "receiver". */
  source: string;
  appId: string | null;
  profileId: string | null;
  deviceHash: string | null;
  sessionId: string | null;
  build: string | null;
  firstAt: number;
  lastAt: number;
  count: number;
};

export type BucketTouch = Omit<BucketSummary, "firstAt" | "count"> & { added: number };

export type BucketFilter = Partial<
  Pick<BucketSummary, "source" | "appId" | "profileId" | "deviceHash" | "sessionId">
>;

/** The bucket a batch goes in: its launch, else its profile, else the receiver's session. */
export function bucketOf(ctx: {
  launchId?: string;
  profileId?: string;
  sessionId?: string;
}): string {
  if (ctx.launchId) return `launch:${ctx.launchId}`;
  if (ctx.profileId) return `profile:${ctx.profileId}`;
  return `receiver:${ctx.sessionId ?? "unknown"}`;
}

/** The bucket's lines plus the new ones, the newest MAX_EVENTS_PER_BUCKET kept. */
export function appendCapped(current: readonly string[], added: readonly string[]): string[] {
  return [...current, ...added].slice(-MAX_EVENTS_PER_BUCKET);
}

/** The index after a write to one bucket: that bucket first, its count and times updated. */
export function touchIndex(list: readonly BucketSummary[], t: BucketTouch): BucketSummary[] {
  const prev = list.find((b) => b.bucket === t.bucket);
  const { added, ...rest } = t;
  const next: BucketSummary = {
    ...rest,
    // A later batch may lack what an earlier one had (no couch session yet): keep what was known.
    appId: rest.appId ?? prev?.appId ?? null,
    profileId: rest.profileId ?? prev?.profileId ?? null,
    deviceHash: rest.deviceHash ?? prev?.deviceHash ?? null,
    sessionId: rest.sessionId ?? prev?.sessionId ?? null,
    build: rest.build ?? prev?.build ?? null,
    firstAt: prev?.firstAt ?? rest.lastAt,
    count: (prev?.count ?? 0) + added,
  };
  return [next, ...list.filter((b) => b.bucket !== t.bucket)].slice(0, MAX_BUCKETS);
}

export function filterIndex(list: readonly BucketSummary[], f: BucketFilter): BucketSummary[] {
  return list.filter(
    (b) =>
      (f.source === undefined || b.source === f.source) &&
      (f.appId === undefined || b.appId === f.appId) &&
      (f.profileId === undefined || b.profileId === f.profileId) &&
      (f.deviceHash === undefined || b.deviceHash === f.deviceHash) &&
      (f.sessionId === undefined || b.sessionId === f.sessionId),
  );
}

/** What the route calls on a ClientLog object (the Durable Object, or a fake in tests). */
export interface ClientLogObject {
  append(lines: string[]): Promise<void>;
  read(limit: number): Promise<string[]>;
  touch(t: BucketTouch): Promise<void>;
  recent(f: BucketFilter): Promise<BucketSummary[]>;
}

export interface ClientLogNamespace<Id = unknown> {
  idFromName(name: string): Id;
  get(id: Id): ClientLogObject;
}

/** Equal strings in time that doesn't depend on where they differ (the log key). */
export function sameKey(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
