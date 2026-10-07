export type StopResult = "stopped" | "failed";

/**
 * The TV tab: the remote while cast through OGS, the Cast screen once a stop is asked for. While a
 * TV switch runs the remote stays (its hero says "Switching to <TV>…"), though for a moment no
 * TV is cast.
 */
export function tvTabShows(input: {
  ogsCast: boolean;
  stopping: boolean;
  switching?: boolean;
}): "remote" | "not-cast" {
  if (input.switching) return "remote";
  return input.ogsCast && !input.stopping ? "remote" : "not-cast";
}

/**
 * Stop casting, as the phone shows it: stopping from the moment it is confirmed (the receiver closes
 * at once, but the stop's reply and the cast session's end can take seconds) until the cast is gone.
 * A stop that fails brings the remote back.
 */
export function createCastStop(deps: { isCast: () => boolean }) {
  let stopping = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === stopping) return;
    stopping = next;
    for (const l of listeners) l();
  };
  return {
    isStopping: () => stopping,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async stop(run: () => Promise<StopResult>): Promise<StopResult> {
      if (stopping) return "stopped";
      set(true);
      const result = await run().catch((): StopResult => "failed");
      if (result === "failed" || !deps.isCast()) set(false);
      return result;
    },
    /** The cast or couch state changed: once the cast is gone, the stop is done. */
    castChanged() {
      if (stopping && !deps.isCast()) set(false);
    },
    /** Casting again. */
    reset: () => set(false),
  };
}
