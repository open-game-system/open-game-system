// Plays the swap forward in live sessions (never in shots): each step stands for real work.
import { useEffect } from "react";
import type { Store } from "../../harness/store";
import { advance, type S } from "./state";

const MS = { saving: 1500, cutover: 1700, following: 1800 } as const;

export function Conductor({ s, store }: { s: S; store: Store<S> }) {
  const t = s.tonight;
  const step = t.kind === "switching" ? t.step : null;
  useEffect(() => {
    if (!step) return;
    const id = setTimeout(() => store.update(advance), MS[step]);
    return () => clearTimeout(id);
  }, [step, store]);
  return null;
}
