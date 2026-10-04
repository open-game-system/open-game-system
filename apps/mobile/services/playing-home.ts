import type { Instance, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { sittingTitle, sittingTitles } from "../components/ogs/library/sitting-title";
import type { AppData } from "./app-state";
import { playedAgo, type Sitting } from "./sittings";
import type { UserMessage } from "./user-message";

/** Where a game plays: only on the TV, only on this phone, or either. */
export type PlaysOn = "tv" | "phone" | "either";

const playsOn = (game: Manifest | undefined): PlaysOn =>
  game?.tv === "required" ? "tv" : game?.tv === "none" ? "phone" : "either";

export interface Pick {
  game: Manifest;
  /** Why it's suggested, or where it plays: "Played yesterday", "Needs the TV". */
  why: string;
}

export type WhatToStart =
  | { kind: "loading" }
  | { kind: "offline"; error: UserMessage | null }
  | { kind: "noGames" }
  | { kind: "suggest"; lead: string; sub: string; picks: Pick[]; offerCast: boolean };

const MAX_PICKS = 4;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function whyFor(game: Manifest, cast: boolean, liveName: string | null): string {
  if (game.tv === "none") return "Plays on this phone";
  if (cast) return liveName ? `Pauses ${liveName}` : "Starts on the TV";
  return game.tv === "required" ? "Casts to the TV first" : "TV or this phone";
}

/**
 * Playing with nothing in progress (spec v3, When nothing's going): what to start now. Last played
 * first, then games that fit the moment (TV games when cast, phone games when not), then the rest.
 * Suggests the library, else the catalogue, so it never promises picks it doesn't show: while
 * loading it says nothing, and when the games couldn't load it says so with a retry.
 */
export function whatToStart(input: {
  status: AppData["status"];
  error: UserMessage | null;
  library: Manifest[];
  catalogue: Manifest[];
  instances: Instance[];
  cast: boolean;
  tvName: string | null;
  now: number;
  /** The game live on the TV now, which starting a TV game pauses. */
  liveName?: string | null;
  /** Games already in progress, left out so the picks are something new. */
  exclude?: string[];
}): WhatToStart {
  const { cast, now } = input;
  const all = input.library.length ? input.library : input.catalogue;
  if (!all.length) {
    if (input.status === "idle" || input.status === "loading") return { kind: "loading" };
    if (input.status === "offline") return { kind: "offline", error: input.error };
    return { kind: "noGames" };
  }
  const games = all.filter((g) => !input.exclude?.includes(g.appId));

  const last = [...input.instances]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .find((i) => games.some((g) => g.appId === i.appId));
  const first = games.find((g) => g.appId === last?.appId);
  const rest = games.filter((g) => g !== first);
  const fits = (g: Manifest) => (cast ? g.tv !== "none" : g.tv !== "required");
  const ordered = [...rest.filter(fits), ...rest.filter((g) => !fits(g))];
  const picks: Pick[] = [
    ...(first && last
      ? [{ game: first, why: `Played ${lowerFirst(playedAgo(last.updatedAt, now))}` }]
      : []),
    ...ordered.map((game) => ({ game, why: whyFor(game, cast, input.liveName ?? null) })),
  ].slice(0, MAX_PICKS);

  const onTv = picks.some((p) => p.game.tv !== "none");
  const onPhone = picks.some((p) => p.game.tv !== "required");
  const sub = cast
    ? `${input.tvName ?? "The TV"} is ready. Pick a game to start on it.`
    : !onTv
      ? "Pick a game to start on this phone."
      : onPhone
        ? "Cast to the TV to play together, or start a game on this phone."
        : "Cast to the TV, then pick a game to start together.";
  return { kind: "suggest", lead: "Nothing in progress", sub, picks, offerCast: !cast && onTv };
}

export interface SittingRow {
  /** The game: the card's eyebrow. */
  name: string;
  /** Its resume point, else when it started ("Started 7:42 PM"). */
  headline: string;
  /** When it was last played ("Played 5 min ago"). */
  meta: string;
  playsOn: PlaysOn;
  /** Where Rejoin lands: "On the TV", "On this phone", "Casts to the TV first", or "Pauses <live game>". */
  where: string;
  /** Rejoin asks first: it would pause the game live on the TV for everyone. */
  asks: boolean;
  /** The headline is the game's own name for the sitting, not the time it started. */
  named: boolean;
}

/** An instance as a sitting to rejoin (its id, resume point and URL). */
export const asSitting = (item: Instance): Sitting => ({
  instanceId: item.instanceId,
  // A Tier 0 visit's title is only the game's name.
  label: item.source === "visit" ? "" : item.title || item.detail,
  at: item.updatedAt,
  resumeUrl: item.resumeUrl,
  live: false,
});

/**
 * One sitting in Playing, named exactly as its game's page names it: the game as the eyebrow, its
 * resume point as the headline, else when it started ("Started 7:42 PM"), never a status word its
 * section already says; when it was last played as the meta.
 */
export function sittingRow(
  item: Instance,
  game: Manifest | undefined,
  now: number,
  cast = false,
  liveName: string | null = null,
): SittingRow {
  const { headline, detail } = sittingTitle(asSitting(item), item.appId, now);
  return row(item, game, headline, detail, cast, liveName, !!asSitting(item).label);
}

/** The live game's headline: its resume point, else when it started. */
export function liveHeadline(
  live: { appId: string; instanceId: string; label: string; startedAt: number },
  now: number,
): string {
  const sitting = {
    instanceId: live.instanceId,
    label: live.label,
    at: live.startedAt,
    resumeUrl: undefined,
    live: true,
  };
  return sittingTitle(sitting, live.appId, now).headline;
}

const row = (
  item: Instance,
  game: Manifest | undefined,
  headline: string,
  meta: string,
  cast: boolean,
  liveName: string | null,
  named: boolean,
): SittingRow => {
  const where = whereItPlays(playsOn(game), cast, liveName);
  return {
    name: game?.name ?? item.appId,
    headline,
    meta,
    playsOn: playsOn(game),
    where,
    asks: where.startsWith("Pauses"),
    named,
  };
};

/** A line every card in a group would repeat ("Casts to the TV first"), said once; else null. */
export function sharedLine(lines: string[]): string | null {
  return lines.length > 1 && lines.every((l) => l === lines[0]) ? lines[0] : null;
}

/** A group's shared line as a note under its title: what starting one does to the TV, said once. */
export function groupNote(shared: string | null): string | null {
  if (!shared) return null;
  return shared.startsWith("Pauses ")
    ? `Starting one pauses ${shared.slice("Pauses ".length)} for everyone`
    : shared;
}

/** The live game's second line: who started it. */
export const liveMeta = (who: string | null): string | null => (who ? `${who} started it` : null);

/** The live game's button: Join a game someone else started, Rejoin your own (or unknown). */
export const liveVerb = (startedBy: string | null): "Join" | "Rejoin" =>
  startedBy && startedBy !== "You" ? "Join" : "Rejoin";

/** Every sitting's card, never two alike within a game ("Game 1", "Game 2"), by instance id. */
export function sittingRows(
  items: Instance[],
  find: (appId: string) => Manifest | undefined,
  now: number,
  cast: boolean,
  liveName: string | null = null,
): Map<string, SittingRow> {
  const rows = new Map<string, SittingRow>();
  for (const appId of new Set(items.map((i) => i.appId))) {
    const mine = items.filter((i) => i.appId === appId);
    const titles = sittingTitles(mine.map(asSitting), appId, now);
    mine.forEach((item, k) => {
      rows.set(
        item.instanceId,
        row(
          item,
          find(appId),
          titles[k].headline,
          titles[k].detail,
          cast,
          liveName,
          !!asSitting(item).label && titles[k].headline === asSitting(item).label,
        ),
      );
    });
  }
  return rows;
}

function whereItPlays(on: PlaysOn, cast: boolean, liveName: string | null): string {
  if (on === "phone" || (on === "either" && !cast)) return "On this phone";
  if (!cast) return "Casts to the TV first";
  return liveName ? `Pauses ${liveName}` : "On the TV";
}

/** Who started the game live on the TV: a member's name, "You" for this phone, else null. */
export function startedBy(
  state: { members: SessionState["members"]; devices: SessionState["devices"] },
  hostDeviceId: string | null,
  myDeviceId: string,
): string | null {
  if (!hostDeviceId) return null;
  if (hostDeviceId === myDeviceId) return "You";
  const profileId = state.devices.find((d) => d.deviceId === hostDeviceId)?.profileId;
  return state.members.find((m) => m.profileId === profileId)?.name ?? null;
}

/** "2–4 players · 10–25 min" from the game's shop facts ("" when it gives none). */
export function gameFacts(game: Manifest): string {
  const { players, minutes } = game.shop;
  const who = players
    ? `${players.replace("-", "–")} ${players === "1" ? "player" : "players"}`
    : "";
  const long = minutes
    ? minutes[0] === minutes[1]
      ? `${minutes[0]} min`
      : `${minutes[0]}–${minutes[1]} min`
    : "";
  return [who, long].filter(Boolean).join(" · ");
}

/**
 * The one sitting Playing leads with when no game is live on the TV (the live game is pinned on
 * top instead): your turn first, else the most recently played sitting you can rejoin. Finished
 * sittings and ones waiting on someone else never lead.
 */
export function heroSitting(items: Instance[], live: boolean): Instance | null {
  if (live) return null;
  const open = items.filter(
    (i) =>
      i.status !== "completed" &&
      i.status !== "expired" &&
      !(i.status === "waiting" && !i.yourTurn),
  );
  const newest = (xs: Instance[]) => [...xs].sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  return newest(open.filter((i) => i.status === "waiting")) ?? newest(open);
}
