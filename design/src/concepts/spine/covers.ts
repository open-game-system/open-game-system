// What a cover says about its game, derived from instance reports and the world clock only.
import { DUELS, WORLD_EVENTS, type GameManifest } from "../../world";
import { instanceOf } from "./session";
import type { S } from "./state";

export type CoverKind = "live" | "turn" | "soon" | "ready" | "paused" | "done" | "new";

export interface CoverStatus {
  kind: CoverKind;
  /** Short, in the spine's voice: the same words on every cover. */
  tag: string;
  /** One line the game wrote. */
  line: string;
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (iso: string) => DAY[new Date(iso).getDay()] ?? "";

export function statusOf(g: GameManifest, s: S): CoverStatus {
  if (s.firstRun) return { kind: "new", tag: g.shape === "async" ? "Over days" : g.shape === "live" ? "Game night" : `Ages ${g.ages}`, line: g.tagline };
  if (s.cast && g.id === s.current) {
    const inst = instanceOf(g.id);
    return { kind: "live", tag: "On the TV", line: inst?.title ?? g.tagline };
  }
  if (g.shape === "async") {
    const yours = s.duel.games.filter((d) => d.status === "yourTurn");
    const first = yours[0];
    if (first) return { kind: "turn", tag: `Your turn · ${yours.length}`, line: first.lastMove };
    const waiting = s.duel.games.filter((d) => d.status === "waiting").length;
    return { kind: "done", tag: `Waiting · ${waiting}`, line: `${waiting} games, their move` };
  }
  const inst = instanceOf(g.id);
  if (!inst) return { kind: "new", tag: `Ages ${g.ages}`, line: g.tagline };
  const reminder = WORLD_EVENTS.find((e) => e.gameId === g.id && e.kind === "reminder");
  if (inst.status === "suspended" && reminder) {
    const at = reminder.text.match(/at (\d{1,2}(:\d\d)?)/)?.[1];
    const who = reminder.text.split(" · ")[1];
    return { kind: "soon", tag: at ? `Tonight at ${at}` : "Tonight", line: who ? `${inst.title} · ${who}` : inst.title };
  }
  const ready = WORLD_EVENTS.find((e) => e.gameId === g.id && e.kind === "ready");
  if (ready) return { kind: "ready", tag: "Ready", line: inst.title };
  if (inst.status === "suspended") return { kind: "paused", tag: `Paused ${weekday(inst.updatedAt)}`, line: inst.title };
  if (inst.status === "active") return { kind: "paused", tag: "Mid-game", line: inst.title };
  return { kind: "done", tag: inst.title.split(" · ")[0] ?? inst.title, line: inst.detail };
}

/** Seen on the async cover, for counts that ignore the session. */
export const duelTotals = () => ({ yours: DUELS.filter((d) => d.status === "yourTurn").length });
