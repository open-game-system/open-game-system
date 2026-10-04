import { type Manifest, readPlayItem, type SessionState } from "@open-game-system/ogs-protocol";

/**
 * The remote's "On the TV" card mirrors the launcher: the focused game's art and logo fill it, with
 * the same paused chip the TV shows ("Paused just now · Mission 6"), and one line for what OK does.
 * Focus ids follow the launcher: `game:<appId>` (an icon), `play:<appId>:<instanceId>` (a sitting
 * card) and `play:<appId>` (Surprise me, with its hidden pick).
 */
export interface TvMirror {
  kind: "home" | "page" | "game" | "surprise";
  /** The game whose art fills the card (null: Home with nothing to show, Surprise, unknown game). */
  game: Manifest | null;
  title: string;
  /** The TV's status chip: "Paused just now", "Playing now". */
  chip: string | null;
  /** Where the sitting stopped: "Mission 6". */
  resume: string | null;
  /** What OK (or the remote) does next. */
  action: string;
  /** Surprise me: the kids' games it picks from. */
  kids: Manifest[];
}

const PICK = "Pick a game with the arrows";
const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
const clock = (t: number) => {
  const d = new Date(t);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** The launcher's words: "just now", "at 7:02", "yesterday", "Tuesday", "Sep 1". */
export function pausedWhen(t: number, now: number): string {
  if (now - t < 2 * 60 * 1000) return "just now";
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (days === 0) return `at ${clock(t)}`;
  if (days === 1) return "yesterday";
  const d = new Date(t);
  if (days < 7) return WEEKDAYS[d.getDay()] ?? "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Kid-friendly: ages start at 5 or under, or the game doesn't say (the launcher's Surprise pool). */
const forKids = (g: Manifest) => {
  const m = g.shop.ages ? /^(\d+)/.exec(g.shop.ages) : null;
  return m?.[1] ? Number(m[1]) <= 5 : true;
};

type Sitting = SessionState["suspended"][number];

const latest = (sittings: Sitting[]): Sitting | null =>
  sittings.reduce<Sitting | null>((a, b) => (a && a.at >= b.at ? a : b), null);

export function tvMirror(input: {
  state: SessionState | null;
  library: Manifest[];
  now: number;
}): TvMirror {
  const { state, library, now } = input;
  const find = (appId: string) => library.find((g) => g.appId === appId) ?? null;
  const suspended = state?.suspended ?? [];
  const sittingOf = (appId: string, instanceId?: string) =>
    latest(
      suspended.filter((s) => s.appId === appId && (!instanceId || s.instanceId === instanceId)),
    );

  const of = (
    kind: TvMirror["kind"],
    appId: string,
    action: (name: string, paused: boolean) => string,
    sitting = sittingOf(appId),
  ): TvMirror => {
    const game = find(appId);
    const title = game?.name ?? appId;
    return {
      kind,
      game,
      title,
      chip: sitting ? `Paused ${pausedWhen(sitting.at, now)}` : null,
      resume: sitting?.label || null,
      action: action(title, sitting !== null),
      kids: [],
    };
  };

  if (state?.screen === "game" && state.current) {
    const game = find(state.current.appId);
    return {
      kind: "game",
      game,
      title: game?.name ?? state.current.appId,
      chip: "Playing now",
      resume: state.current.label || null,
      action: "Home pauses it and shows the games",
      kids: [],
    };
  }
  if (state?.screen === "game-page" && state.page) {
    const restart = state.focus === "action:new";
    return of("page", state.page, (name, paused) =>
      restart && paused
        ? "OK starts a new game"
        : paused
          ? `OK continues ${name}`
          : `OK starts ${name}`,
    );
  }

  const focus = state?.focus ?? null;
  const play = readPlayItem(focus);
  // Surprise me carries the launcher's hidden pick (`play:<appId>`): the phone never reveals it.
  if (play && !play.instanceId)
    return {
      kind: "surprise",
      game: null,
      title: "Surprise me",
      chip: null,
      resume: null,
      action: "OK picks a game for the kids",
      kids: library.filter(forKids),
    };
  if (play?.instanceId)
    return of(
      "home",
      play.appId,
      (name) => `OK continues ${name}`,
      sittingOf(play.appId, play.instanceId),
    );
  const focused = focus ? /^game:([a-z0-9-]+)$/.exec(focus)?.[1] : undefined;
  if (focused)
    return of("home", focused, (name, paused) =>
      paused ? `OK continues ${name}` : `OK opens ${name}`,
    );

  const last = latest(suspended);
  if (last) return of("home", last.appId, () => PICK, last);
  return {
    kind: "home",
    game: null,
    title: "Home",
    chip: null,
    resume: null,
    action: PICK,
    kids: [],
  };
}
