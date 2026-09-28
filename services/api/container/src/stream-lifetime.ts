/**
 * How long a stream may run. The TV receiver's heartbeat keeps this (GPU) server up; if a cast is
 * forgotten, that would bill all night. Past maxMs the server ends the stream and refuses
 * heartbeats, so the pings stop and Cloud Run can scale to zero.
 */
export function createStreamLifetime({ maxMs, now = Date.now }: { maxMs: number; now?: () => number }) {
  let startedAt: number | null = null;
  return {
    started() {
      startedAt = now();
    },
    stopped() {
      startedAt = null;
    },
    expired(): boolean {
      return startedAt !== null && now() - startedAt > maxMs;
    },
  };
}
