// Everything the launcher shows is derived from manifests + what games report. No game ids here.
import { COUCH, DUELS, GAMES, HEARTHISLE, HOME, WORLD_EVENTS, person, type DuelGame, type GameManifest, type Instance, type Person } from "../../world";

export type ActionKind = "continue" | "new" | "play" | "night";
export interface HubAction { kind: ActionKind; label: string }

export type CardAction = { kind: "continue" } | { kind: "duel"; duelId: string } | { kind: "none" };
export interface HubCard {
  id: string;
  kicker: string;
  title: string;
  detail?: string;
  art?: string;
  stickers?: string[];
  tone: "accent" | "plain" | "quiet";
  action: CardAction;
}

export interface Hub {
  game: GameManifest;
  /** One line under the title: where it is, in words the game wrote. */
  status: string;
  actions: HubAction[];
  cards: HubCard[];
  /** Small tag on the icon (≥ 24 px on TV). */
  badge?: string;
}

const LIVE = [HEARTHISLE];
export const instanceFor = (gameId: string): Instance | undefined => [...COUCH, ...LIVE].find((i) => i.gameId === gameId);
const eventsFor = (gameId: string) => WORLD_EVENTS.filter((e) => e.gameId === gameId);
export const duelsFor = (g: GameManifest): DuelGame[] => (g.shape === "async" ? DUELS : []);

const time = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
};
const day = (iso: string) => {
  const d = new Date(iso);
  const today = new Date("2026-10-03T12:00:00-07:00");
  const diff = Math.floor((today.getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff <= 0) return d.getHours() >= 17 ? `tonight ${time(iso)}` : `today ${time(iso)}`;
  if (diff === 1) return "yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long" });
};

/** First segment of a game-written title ("Mission 6 · Navigator rank" → "Mission 6"). */
export const resumeShort = (title: string) => title.split(" · ")[0] ?? title;

/** Most recent thing that happened in a game, for ordering the row like a console does. */
const lastActivity = (g: GameManifest): number => {
  const stamps = [instanceFor(g.id)?.updatedAt, ...eventsFor(g.id).map((e) => e.at), ...duelsFor(g).filter((d) => d.status === "yourTurn").map((d) => d.updatedAt)];
  return Math.max(0, ...stamps.filter((x): x is string => !!x).map((x) => new Date(x).getTime()));
};

export const ROW: GameManifest[] = [...GAMES].sort((a, b) => lastActivity(b) - lastActivity(a));
export const rowIndex = (gameId: string) => ROW.findIndex((g) => g.id === gameId);

/** The role each person takes, chosen by age band from the game's manifest. */
export function roleFor(g: GameManifest, p: Person) {
  return g.roles.find((r) => r.audience === p.band) ?? g.roles.find((r) => r.audience === (p.band === "little" ? "kid" : p.band)) ?? g.roles[0];
}

export const stickersOf = (ids: string[]) => ids.map((id) => person(id).sticker);

function couchHub(g: GameManifest, suspendedAt?: string): Hub {
  const inst = instanceFor(g.id);
  const events = eventsFor(g.id);
  const resumable = !!suspendedAt || inst?.status === "active" || inst?.status === "suspended";
  const resumeTitle = suspendedAt ?? inst?.title;
  const cards: HubCard[] = [];
  if (inst && resumable && resumeTitle) {
    cards.push({ id: "resume", kicker: suspendedAt ? "Suspended tonight" : inst.status === "active" ? `Played ${day(inst.updatedAt)}` : `Paused ${day(inst.updatedAt)}`, title: resumeTitle, detail: inst.detail.split(" · ")[0], art: g.art.alt ?? g.art.tv, tone: "accent", action: { kind: "continue" } });
  }
  for (const e of events) cards.push({ id: e.id, kicker: e.kind === "ready" ? "Ready" : "New", title: e.text.split(":")[0] ?? e.text, detail: e.text.split(": ")[1], art: e.kind === "ready" ? inst?.seats.flatMap((s) => s.personIds).map((id) => person(id)).find((p) => p.band !== "grownup")?.sticker : g.art.alt, tone: "accent", action: { kind: "none" } });
  if (inst && !resumable && !events.some((e) => e.text.startsWith(inst.title))) cards.push({ id: "last", kicker: `Last time · ${day(inst.updatedAt)}`, title: inst.title, detail: inst.detail.split(" · ")[0], art: g.art.alt ?? g.art.tv, tone: "plain", action: { kind: "none" } });
  if (inst && inst.seats.length) cards.push({ id: "crew", kicker: "Last crew", title: inst.seats.map((s) => s.personIds.map((id) => person(id).name).join(" + ")).join(", "), detail: inst.seats.map((s) => s.label).join(" · "), stickers: inst.seats.flatMap((s) => s.personIds).map((id) => person(id).sticker), tone: "plain", action: { kind: "none" } });
  if (inst?.save) cards.push({ id: "save", kicker: "Saved with OGS", title: inst.save.summary.split(" · ").slice(0, 2).join(" · "), tone: "quiet", action: { kind: "none" } });
  const actions: HubAction[] = resumable && resumeTitle ? [{ kind: "continue", label: `Continue · ${resumeShort(resumeTitle)}` }, { kind: "new", label: "New game" }] : [{ kind: "play", label: "Play" }];
  const status = suspendedAt ? `Suspended at ${suspendedAt}` : inst ? (resumable ? inst.detail : inst.detail) : g.tagline;
  return { game: g, status, actions, cards: cards.slice(0, 4), badge: suspendedAt ? "Suspended" : events.some((e) => e.kind === "ready") ? "Ready" : undefined };
}

function liveHub(g: GameManifest): Hub {
  const inst = instanceFor(g.id);
  const events = eventsFor(g.id);
  if (!inst) return { game: g, status: g.tagline, actions: [{ kind: "night", label: "New game night" }], cards: [] };
  const cards: HubCard[] = events.map((e) => ({ id: e.id, kicker: "Tonight", title: e.text.split(" · ")[0] ?? e.text, detail: e.text.split(" · ")[1], tone: "accent" as const, action: { kind: "none" as const } }));
  for (const s of inst.seats) cards.push({ id: s.householdId, kicker: s.label === inst.turn ? "Their roll next" : `${s.score ?? 0} points`, title: s.label.split(" (")[0] ?? s.label, detail: HOME.id === s.householdId ? "Our TV" : s.online ? "Online" : "Not on yet", stickers: s.personIds.map((id) => person(id).sticker), tone: "plain", action: { kind: "none" } });
  return { game: g, status: `${inst.title} · resumes tonight at 8`, actions: [{ kind: "night", label: "Open game night" }], cards: cards.slice(0, 4), badge: "Tonight" };
}

function asyncHub(g: GameManifest, played: string[]): Hub {
  const duels = duelsFor(g).filter((d) => d.status === "yourTurn" || d.status === "waiting");
  const mine = duels.filter((d) => d.status === "yourTurn" && !played.includes(d.id));
  const cards: HubCard[] = [...mine, ...duels.filter((d) => !mine.includes(d))].slice(0, 4).map((d) => {
    const yours = mine.includes(d);
    return { id: d.id, kicker: yours ? "Your turn" : `${d.opponent}'s turn`, title: yours ? d.lastMove : `Waiting on ${d.opponent}`, detail: `${d.you} – ${d.them} · ${d.opponentHome}`, stickers: [d.sticker], tone: yours ? "accent" : "plain", action: yours ? { kind: "duel", duelId: d.id } : { kind: "none" } };
  });
  return { game: g, status: mine.length ? `${mine.length === 1 ? "One game is" : `${mine.length} games are`} waiting on you · played on your phone` : "Every game is waiting on the other player", actions: [], cards, badge: mine.length ? `${mine.length}` : undefined };
}

export function hubFor(g: GameManifest, suspended: Record<string, string>, played: string[]): Hub {
  if (g.shape === "async") return asyncHub(g, played);
  if (g.shape === "live") return liveHub(g);
  return couchHub(g, suspended[g.id]);
}

/** Couch games you can switch to from the control centre: resumable ones first. */
export function switchTargets(current: string, suspended: Record<string, string>): GameManifest[] {
  const couch = ROW.filter((g) => g.shape === "couch" && g.id !== current);
  const resumable = (g: GameManifest) => !!suspended[g.id] || instanceFor(g.id)?.status === "suspended" || instanceFor(g.id)?.status === "active";
  return [...couch.filter(resumable), ...couch.filter((g) => !resumable(g))];
}

export const resumeLabel = (gameId: string, suspended: Record<string, string>) => suspended[gameId] ?? instanceFor(gameId)?.title ?? "";
export const duelById = (id: string) => DUELS.find((d) => d.id === id);
