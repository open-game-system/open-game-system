import type { NativeLogEvent, NativeLogSource } from "./airplay-display";
import type { ClientLog } from "./client-log";

/**
 * Every native event (NativeLog.swift: screens, scenes, audio routes, the TV WebView, app state,
 * keep-awake) into the app's client log as `native.<type>`, so one launch's log has both sides.
 * Listens first, then reads the ring of what happened before JS was listening; `seq` drops the
 * overlap. Returns a stop.
 */
export function forwardNativeLog(native: NativeLogSource, log: ClientLog): () => void {
  if (!native.available) return () => {};
  let lastSeq = 0;
  const forward = (e: NativeLogEvent) => {
    if (e.seq <= lastSeq) return;
    lastSeq = e.seq;
    log.event(`native.${e.type}`, {
      level: e.level,
      data: { ...e.data, nativeAt: e.at, seq: e.seq },
    });
  };
  const held: NativeLogEvent[] = [];
  let backfilled = false;
  const sub = native.onLog((e) => {
    if (backfilled) forward(e);
    else held.push(e);
  });
  void native
    .recentLog(0)
    .catch((): NativeLogEvent[] => [])
    .then((ring) => {
      for (const e of ring) forward(e);
      backfilled = true;
      for (const e of held.splice(0)) forward(e);
    });
  return () => sub.remove();
}
