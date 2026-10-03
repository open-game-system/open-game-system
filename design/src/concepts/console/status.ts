// One status vocabulary for every game, every lane, every device. A status is a kind (which picks
// the glyph and tone) plus its words; colour is never the only signal: each kind has its own glyph.
import { COUCH, type Instance } from "../../world";

export type StatusKind =
  | "live" // Live on TV
  | "yours" // Your turn
  | "theirs" // Their turn
  | "tonight" // Tonight 8:00
  | "paused" // Paused Tue · Saved 7:14
  | "ready" // Ready · New
  | "invited" // Invited · waiting on a home
  | "done" // Done
  | "closed"; // Closed (expired)

export interface Status {
  kind: StatusKind;
  label: string;
}

export const st = (kind: StatusKind, label: string): Status => ({ kind, label });

export const LIVE = st("live", "Live on TV");
export const YOURS = st("yours", "Your turn");
export const THEIRS = st("theirs", "Their turn");
export const DONE = st("done", "Done");
export const CLOSED = st("closed", "Closed");

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayOf = (iso: string): string => DAY[new Date(iso).getDay()] ?? "";

/** A couch game's status, from what its instance reports and what the console did tonight. */
export function couchStatus(gameId: string, onTv: string | null, savedTonight: Record<string, string>): Status {
  if (onTv === gameId) return LIVE;
  const saved = savedTonight[gameId];
  if (saved) return st("paused", `Saved ${saved.replace(" pm", "")}`);
  const inst: Instance | undefined = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return st("ready", "Ready");
  if (inst.status === "active") return st("paused", "Paused tonight");
  if (inst.status === "suspended") return st("paused", `Paused ${dayOf(inst.updatedAt)}`);
  if (inst.status === "completed" && inst.updatedAt > "2026-10-03") return st("ready", "Ready");
  if (inst.status === "completed" && inst.updatedAt > "2026-10-02") return st("ready", "New");
  return st("ready", "Ready");
}
