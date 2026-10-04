import { useEffect, useState } from "react";

/**
 * True once `waiting` (a sitting still waiting for its TV page, from waitingForView) has waited
 * `timeoutMs`. A new wait (another sitting, or the same one started again) starts the clock over.
 */
export function useViewTimeout(waiting: string | null, timeoutMs: number): boolean {
  const [overdue, setOverdue] = useState<string | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setOverdue(waiting), timeoutMs);
    return () => clearTimeout(t);
  }, [waiting, timeoutMs]);
  return waiting !== null && overdue === waiting;
}
