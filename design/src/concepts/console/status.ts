// One status vocabulary for every game, every lane, every device, and one bucket rule.
//
//   Live · Your turn · Their turn · Paused at … · Coming up · Ready · New · Invited · Done · Closed
//
// A status is a kind (which picks the glyph AND the chip's shape) plus its words; colour is never
// the only signal. Words are the family's, never integration jargon: no tiers, no "instances".
import { COUCH, type Instance } from "../../world";

export type StatusKind =
  | "live" // Live: on our TV right now
  | "yours" // Your turn / Your roll
  | "theirs" // Their turn / Okafors rolling
  | "paused" // Paused at day 4
  | "coming" // Coming up: a game night with a time ("Tonight 8:00")
  | "ready" // Ready: start it whenever (nothing saved, nothing new)
  | "new" // New: something happened in the game since you last looked
  | "invited" // Invited: waiting on homes to answer
  | "done" // Done
  | "closed"; // Closed (nobody moved for 14 days)

export interface Status {
  kind: StatusKind;
  label: string;
}

export const st = (kind: StatusKind, label: string): Status => ({ kind, label });

export const LIVE = st("live", "Live");
export const YOURS = st("yours", "Your turn");
export const THEIRS = st("theirs", "Their turn");
export const READY = st("ready", "Ready");
export const DONE = st("done", "Done");
export const CLOSED = st("closed", "Closed");

/**
 * The bucket rule: every game the family has open sits in exactly one bucket.
 * - tv: on our TV right now · yours: waiting on us · coming: has a time set (game nights)
 * - theirs: waiting on someone else · paused: stopped, no time set · done: finished or closed
 */
export type Bucket = "tv" | "yours" | "coming" | "theirs" | "paused" | "done";

export const BUCKET_TITLE: Record<Bucket, string> = {
  tv: "On the TV",
  yours: "Your turn",
  coming: "Coming up",
  theirs: "Their turn",
  paused: "Paused",
  done: "Finished",
};

export function bucketOf(status: Status): Bucket {
  switch (status.kind) {
    case "live":
      return "tv";
    case "yours":
      return "yours";
    case "coming":
    case "invited":
      return "coming";
    case "theirs":
      return "theirs";
    case "paused":
    case "ready":
    case "new":
      return "paused";
    case "done":
    case "closed":
      return "done";
  }
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayOf = (iso: string): string => DAY[new Date(iso).getDay()] ?? "";

/** "Mission 6 · Navigator rank" → "mission 6": the resume point, as it reads after "Paused at". */
export const pointOf = (title: string): string => {
  const head = title.split(" · ")[0] ?? title;
  return head.charAt(0).toLowerCase() + head.slice(1);
};

/** A couch game's status, from what its game reports and what the console did tonight. */
export function couchStatus(gameId: string, onTv: string | null, savedTonight: Record<string, string>): Status {
  if (onTv === gameId) return LIVE;
  const inst: Instance | undefined = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return READY;
  if (savedTonight[gameId] || inst.status === "active" || inst.status === "suspended") return st("paused", `Paused at ${pointOf(inst.title)}`);
  // Something new happened since this morning (Story Nook finished painting Juneau's character).
  if (inst.status === "completed" && inst.updatedAt > "2026-10-03") return st("new", "New");
  return READY;
}

/** The one line under a couch game's name, in the same words as its chip (never "New" beside progress). */
export function couchLine(gameId: string, onTv: string | null, savedTonight: Record<string, string>): string {
  const inst = COUCH.find((i) => i.gameId === gameId);
  if (!inst) return "Start whenever you like";
  const saved = savedTonight[gameId];
  if (onTv === gameId) return inst.title.split(" · ")[0] ?? inst.title;
  if (saved) return `Saved tonight at ${saved}`;
  if (inst.status === "active") return "Saved tonight";
  if (inst.status === "suspended") return `Saved ${dayLong(inst.updatedAt)}`;
  if (inst.status === "completed" && inst.updatedAt > "2026-10-03") return inst.title;
  return inst.title;
}

const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayLong = (iso: string): string => DAY_LONG[new Date(iso).getDay()] ?? "";
