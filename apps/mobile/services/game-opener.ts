import type { ClientMessage, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import { createGamePresence } from "./game-presence";
import { createGameUrls, rejoinUrl, rememberGame } from "./game-rejoin";
import { launchPlan } from "./launch-plan";
import type { ReturnPill } from "./leave-game";
import { roomStartUrl } from "./rooms";
import { sittingToOpen } from "./sittings";

type GameStart = Extract<ClientMessage, { type: "game.start" }>;

/** Where opening a game sends the app: the game screen, or a game's page in Library. */
export type GameRoute =
  | {
      pathname: "/game";
      params: { url: string; name: string; appId?: string; instanceId?: string };
    }
  | { pathname: "/library/[appId]"; params: { appId: string } };

/**
 * Opening a game, every way it happens (spec v3, Where a game plays): a tap (start, continue or a
 * named sitting), the return pill, the couch session's host follow, and a room join. It decides
 * where the game plays (the TV's stream or this phone), which URL opens (the start page, a resume
 * point, or the room the game was left in: Rejoin), which sitting the screen holds, and makes sure
 * one game is never opened twice (a host follow for a game this phone already opened).
 *
 * The game screen tells it when a game is opening, closed, and where it was left (`remember`).
 */
export function createGameOpener(deps: {
  /** The profile's library: the games a pill or a host follow can open. */
  library: () => readonly Manifest[];
  session: () => SessionState | null;
  pill: () => ReturnPill | null;
  /** Is the TV cast through OGS right now? */
  ogsCast: () => boolean;
  deviceId: () => string;
  send: (msg: GameStart) => void;
  navigate: (route: GameRoute) => void;
  now: () => number;
}) {
  const presence = createGamePresence();
  /** Each game's latest page (its room), so Rejoin returns there instead of starting a new one. */
  const gameUrls = createGameUrls();

  const findInLibrary = (appId: string) => deps.library().find((g) => g.appId === appId);

  function rejoinUrlFor(appId: string, instanceId?: string): string | undefined {
    return rejoinUrl(appId, {
      remembered: gameUrls.get(appId),
      session: deps.session(),
      pill: deps.pill(),
      instanceId,
    });
  }

  function show(game: Pick<Manifest, "appId" | "name">, url: string, instanceId?: string) {
    presence.opening(game.appId);
    deps.navigate({
      pathname: "/game",
      params: { url, name: game.name, appId: game.appId, ...(instanceId ? { instanceId } : {}) },
    });
  }

  /** A tap on a game. `instanceId` names one sitting to rejoin (a game's page lists several). */
  function open(
    game: Manifest,
    opts: { mode?: "continue" | "new"; resumeUrl?: string; instanceId?: string } = {},
  ) {
    const isNew = opts.mode === "new";
    const resumeUrl =
      opts.resumeUrl ?? (isNew ? undefined : rejoinUrlFor(game.appId, opts.instanceId));
    const instanceId = isNew ? undefined : opts.instanceId;
    const plan = launchPlan({
      manifest: game,
      ogsCast: deps.ogsCast(),
      deviceId: deps.deviceId(),
      mode: opts.mode,
      resumeUrl,
      instanceId,
    });
    const sitting = sittingToOpen(game.appId, { instanceId, resumeUrl }, deps.now());
    switch (plan.kind) {
      case "tv":
        deps.send(plan.start);
        show(game, plan.url, sitting);
        break;
      case "phone":
        show(game, plan.url, sitting);
        break;
      case "needs-tv":
        deps.navigate({ pathname: "/library/[appId]", params: { appId: game.appId } });
        break;
    }
  }

  return {
    open,
    /** The return pill: back into its game (and sitting), or its page when it isn't a library game. */
    openPill(pill: ReturnPill) {
      const game = pill.appId ? findInLibrary(pill.appId) : undefined;
      if (game) open(game, { resumeUrl: pill.url, instanceId: pill.instanceId });
      else deps.navigate({ pathname: "/game", params: { url: pill.url, name: pill.name } });
    },
    /**
     * A game started from the TV with the remote: this phone hosts it, so open its start page.
     * Continuing a paused game hosts its same room again, not a fresh one from the start page; a
     * sitting in another couch's room (spec §7) starts by joining that room.
     */
    followHost({ appId, instanceId, room }: { appId: string; instanceId: string; room?: string }) {
      const game = findInLibrary(appId);
      if (!game) return;
      const start = room ? roomStartUrl(game.startUrl, room) : game.startUrl;
      presence.followHost(appId, () => show(game, rejoinUrlFor(appId, instanceId) ?? start));
    },
    /** Open `game` at `url` as it is (a room join already planned the start). */
    show: (game: Pick<Manifest, "appId" | "name">, url: string) => show(game, url),
    /** The game screen for `appId` is up (before it mounts: the follow can arrive first). */
    opening: (appId: string) => presence.opening(appId),
    /** The game screen for `appId` unmounted. */
    closed: (appId: string) => presence.closed(appId),
    /** The game screen is closing on `url` (the WebView's latest page): remember it for Rejoin. */
    remember(appId: string, url: string) {
      gameUrls.record(rememberGame(appId, url, deps.session()));
    },
  };
}

export type GameOpener = ReturnType<typeof createGameOpener>;
