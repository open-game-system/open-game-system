// Wraps every device's surface. With no fault it renders the surface untouched. With one, each
// device gets the same failure from its own seat: the phone explains and offers one action, the TV
// stays calm (a corner chip, or one card when the picture itself is gone), kid iPads wait wordlessly.
import { useEffect, type ReactNode } from "react";
import type { Device } from "../../../harness/types";
import type { Store } from "../../../harness/store";
import { useStore } from "../../../harness/store";
import type { S } from "../state";
import { nextBeat, type Fault, type FaultPhase } from "./fault";
import { EdgeKid } from "./ipad";
import { EdgePhone, foundTv } from "./phone";
import { EdgeTv } from "./tv";

export function EdgeLayer({ device, store, seat, children }: { device: Device; store: Store<S>; seat?: string; children: ReactNode }) {
  const s = useStore(store);
  const f = s.fault;
  // One clock for the simulated recovery, run from the phone so the stage doesn't run it four times.
  useEdgeClock(device === "phone" ? f : null, store);
  if (!f || f.phase === "armed") return <>{children}</>;
  if (device === "phone") return <>{EdgePhone({ s, store, f, children })}</>;
  if (device === "tv") return <>{EdgeTv({ s, f, children })}</>;
  if (device === "ipad") return <>{EdgeKid({ s, f, seat, children })}</>;
  return <>{children}</>;
}

const isShot = (): boolean => typeof document !== "undefined" && document.documentElement.classList.contains("shot");

/** What reaching a phase does to the rest of the session (most phases change only the fault). */
function land(s: S, to: FaultPhase | "clear"): S {
  if (!s.fault) return s;
  if (to === "clear") return { ...s, fault: null };
  const f: Fault = { ...s.fault, phase: to };
  // The TV turned up: start tonight exactly as if it had been there all along.
  if (f.kind === "no-tv" && to === "recovered") return { ...foundTv(s), fault: f };
  return { ...s, fault: f };
}

function useEdgeClock(f: Fault | null, store: Store<S>) {
  const beat = f ? nextBeat(f) : null;
  const key = f && beat ? `${f.kind}:${f.phase}:${f.viewer ?? ""}` : null;
  useEffect(() => {
    if (!key || !beat || isShot()) return;
    const t = setTimeout(() => store.update((x) => land(x, beat.to)), beat.after);
    return () => clearTimeout(t);
    // `beat` is derived from `key`'s parts.
  }, [key, store]); // eslint-disable-line react-hooks/exhaustive-deps
}
