// The world, played by the prototype: a move arrives a beat after the phone opens (frozen in shots).
import { useEffect } from "react";
import type { Store } from "../../../harness/store";
import { moveArrives, type S } from "../state";

export function useArrivalClock(s: S, store: Store<S>, shot: boolean) {
  const armed = s.arrival?.phase === "armed";
  useEffect(() => {
    if (shot || !armed) return;
    const t = setTimeout(() => store.update(moveArrives), 1300);
    return () => clearTimeout(t);
  }, [armed, shot, store]);
}
