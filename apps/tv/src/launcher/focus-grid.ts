/** The launcher's layout as the remote sees it: rows of focusable item ids. Pure. */
export interface FocusRow {
  id: string;
  items: string[];
}
export type Dir = "up" | "down" | "left" | "right";

export function firstFocus(rows: FocusRow[]): string | null {
  for (const r of rows) if (r.items[0] !== undefined) return r.items[0];
  return null;
}

export function locate(rows: FocusRow[], id: string | null): { row: number; col: number } | null {
  if (id === null) return null;
  for (let row = 0; row < rows.length; row++) {
    const col = rows[row]?.items.indexOf(id) ?? -1;
    if (col >= 0) return { row, col };
  }
  return null;
}

function rowStep(rows: FocusRow[], from: number, step: 1 | -1): number | null {
  for (let r = from + step; r >= 0 && r < rows.length; r += step) {
    if ((rows[r]?.items.length ?? 0) > 0) return r;
  }
  return null;
}

/** Where the ring goes on a remote press. Never wraps; an unknown focus recovers to the first item. */
export function move(rows: FocusRow[], focus: string | null, dir: Dir): string | null {
  const at = locate(rows, focus);
  if (!at) return firstFocus(rows);
  const next =
    dir === "left" || dir === "right" ? sideways(rows, at, dir) : vertical(rows, at, dir);
  return next ?? focus;
}

type At = { row: number; col: number };

/** Left or right within the row, stopping at its ends. */
function sideways(rows: FocusRow[], at: At, dir: "left" | "right"): string | undefined {
  const items = rows[at.row]?.items ?? [];
  return items[dir === "left" ? Math.max(0, at.col - 1) : Math.min(items.length - 1, at.col + 1)];
}

/** Up or down to the nearest non-empty row, at the same column or its last item. */
function vertical(rows: FocusRow[], at: At, dir: "up" | "down"): string | undefined {
  const target = rowStep(rows, at.row, dir === "down" ? 1 : -1);
  if (target === null) return undefined;
  const next = rows[target]?.items ?? [];
  return next[Math.min(at.col, next.length - 1)];
}
