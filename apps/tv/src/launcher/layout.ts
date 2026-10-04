import {
  type Instance,
  type Manifest,
  playingView,
  type SuspendedGame,
} from "@open-game-system/ogs-protocol";
import type { FocusRow } from "./focus-grid";

export type RowId = "continue" | "tonight" | "library";

export interface BoxModel {
  /** The manifest's HUD-free crop for cover and hero. */
  safe?: Manifest["art"]["safe"];
  itemId: string;
  appId: string;
  name: string;
  tagline: string;
  cover: string;
  hero: string;
  /** The status chip, e.g. "Paused Tuesday". Empty for a game you haven't started. */
  tag: string;
  /** The resume point on the spine, e.g. "Mission 6". */
  resume: string;
}

export interface RowModel {
  id: RowId;
  title: string;
  boxes: BoxModel[];
}

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function clock(t: number): string {
  const d = new Date(t);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);

/** "just now", "at 7:02", "yesterday", "Tuesday", "Sep 1". */
export function when(t: number, now: number): string {
  if (now - t < 2 * 60 * 1000) return "just now";
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (days === 0) return `at ${clock(t)}`;
  if (days === 1) return "yesterday";
  const d = new Date(t);
  if (days < 7) return WEEKDAYS[d.getDay()] ?? "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function box(game: Manifest, tag: string, resume: string): BoxModel {
  return {
    itemId: `game:${game.appId}`,
    appId: game.appId,
    name: game.name,
    tagline: game.tagline,
    cover: game.art.tile,
    hero: game.art.hero ?? game.art.tile,
    safe: game.art.safe,
    tag,
    resume,
  };
}

/**
 * Status first: what you paused (Continue), what's on tonight (Tonight), then the rest of the
 * household's TV games (Library). Each game appears once, so the focus ring is never ambiguous.
 */
export function buildRows(input: {
  games: Manifest[];
  instances: Instance[];
  suspended: SuspendedGame[];
  now: number;
}): RowModel[] {
  const { now } = input;
  const tvGames = new Map(input.games.filter((g) => g.tv !== "none").map((g) => [g.appId, g]));
  const ttl = new Map(input.games.map((g) => [g.appId, g.instanceTtlMs]));
  const view = playingView(input.instances, {
    now,
    liveInstanceIds: [],
    ttlFor: (appId) => ttl.get(appId) ?? 0,
  });
  const placed = new Set<string>();
  const take = (appId: string) => {
    const g = tvGames.get(appId);
    if (!g || placed.has(appId)) return null;
    placed.add(appId);
    return g;
  };
  const section = (kind: string) => view.sections.find((s) => s.kind === kind)?.items ?? [];

  const cont: BoxModel[] = [];
  for (const s of input.suspended) {
    const g = take(s.appId);
    if (g) cont.push(box(g, `Paused ${when(s.at, now)}`, s.label));
  }
  for (const i of section("paused")) {
    const g = take(i.appId);
    if (g) cont.push(box(g, `Played ${when(i.updatedAt, now)}`, i.title || i.detail));
  }
  const tonight: BoxModel[] = [];
  for (const i of section("tonight")) {
    const g = take(i.appId);
    if (g) tonight.push(box(g, `Tonight at ${clock(i.startsAt ?? now)}`, i.title || i.detail));
  }
  const library: BoxModel[] = [];
  for (const appId of tvGames.keys()) {
    const g = take(appId);
    if (g) library.push(box(g, "", g.tagline));
  }
  const rows: RowModel[] = [
    { id: "continue", title: "Continue", boxes: cont },
    { id: "tonight", title: "Tonight", boxes: tonight },
    { id: "library", title: "Library", boxes: library },
  ];
  return rows.filter((r) => r.boxes.length > 0);
}

export const focusRows = (rows: RowModel[]): FocusRow[] =>
  rows.map((r) => ({ id: r.id, items: r.boxes.map((b) => b.itemId) }));
