import type { ClientMessage, Manifest } from "@open-game-system/ogs-protocol";
import { playingView } from "@open-game-system/ogs-protocol";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { createAppState } from "./app-state";
import type { CastBackend } from "./cast-backend";
import { castToTv, createGameCastStore, endForTonight } from "./cast-flow";
import { createCastStore } from "./cast-store";
import { castCommands, startCastSync } from "./cast-sync";
import { OGS_STREAM_SERVER_URL } from "./cast-view";
import { appConfig, isLauncherView } from "./config";
import {
  type CouchSession,
  type CouchSnapshot,
  couchSocketUrl,
  createCouchSession,
  type SocketLike,
} from "./couch-session";
import { createFakeCastBackend } from "./fake-cast";
import { isOgsCast } from "./game-cast-route";
import { createGamePresence } from "./game-presence";
import { createGameUrls, rejoinUrl, rememberGame } from "./game-rejoin";
import { createGoogleCastBackend } from "./google-cast-backend";
import { launchPlan } from "./launch-plan";
import type { ReturnPill } from "./leave-game";
import { createOgsApi } from "./ogs-api";

/**
 * The app's singletons, wired once for its lifetime: config, cast backend (real or fake) and the
 * cast store kept in step with it, the OGS API, the app data store, and the couch session (started
 * once this phone has a household). Screens read them through the hooks at the bottom.
 */

export const config = appConfig;

const fetchImpl = (url: string, init?: RequestInit) => fetch(url, init);

export const castBackend: CastBackend =
  config.fakeCast === "off"
    ? createGoogleCastBackend()
    : createFakeCastBackend({
        mode: config.fakeCast,
        loadUrl: config.fakeCastUrl,
        fetch: fetchImpl,
      });

const commands = castCommands(() => castBackend.showCastDialog());
export const castStore = createCastStore(commands);
startCastSync(castStore, castBackend.sessionManager, commands, OGS_STREAM_SERVER_URL);
castBackend.subscribeDevices((devices) => castStore.dispatch({ type: "DEVICES_UPDATED", devices }));

const auth = () => {
  const id = appState.getSnapshot().identity;
  return id ? { householdId: id.householdId, token: id.token } : null;
};

export const api = createOgsApi({ baseUrl: config.apiBase, fetch: fetchImpl, auth });

export const appState = createAppState({
  api,
  storage: SecureStore,
  deviceName: Device.deviceName ?? "Phone",
  newDeviceId: () => Crypto.randomUUID(),
});

// --- Couch session -------------------------------------------------------------------------

const CLOSED: CouchSnapshot = { status: "closed", state: null, remoteOffer: null, error: null };
let couch: CouchSession | null = null;
const couchListeners = new Set<() => void>();
const notifyCouch = () => {
  for (const l of couchListeners) l();
};

function webSocket(url: string): SocketLike {
  const ws = new WebSocket(url);
  const s: SocketLike = {
    get readyState() {
      return ws.readyState;
    },
    send: (data) => ws.send(data),
    close: () => ws.close(),
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  ws.onopen = () => s.onopen?.();
  ws.onmessage = (ev) => s.onmessage?.({ data: ev.data });
  ws.onclose = () => s.onclose?.();
  ws.onerror = () => s.onerror?.();
  return s;
}

export const couchHub = {
  getSnapshot: (): CouchSnapshot => couch?.getSnapshot() ?? CLOSED,
  subscribe(listener: () => void) {
    couchListeners.add(listener);
    return () => {
      couchListeners.delete(listener);
    };
  },
  send(msg: ClientMessage) {
    couch?.send(msg);
  },
  takeRemote: () => couch?.takeRemote(),
  dismissRemoteOffer: () => couch?.dismissRemoteOffer(),
};

function startCouch() {
  const id = appState.getSnapshot().identity;
  if (!id || couch) return;
  couch = createCouchSession({
    url: couchSocketUrl(config.apiBase, id.token),
    deviceId: id.deviceId,
    createSocket: webSocket,
    // A game started from the TV with the remote: this phone hosts it, so open its start page.
    onFollowHost: ({ appId, instanceId }) => {
      const game = appState.getSnapshot().library.find((g) => g.appId === appId);
      // Continuing a paused game hosts its same room again, not a fresh one from the start page.
      if (game)
        gamePresence.followHost(appId, () =>
          pushGame(game, rejoinUrlFor(appId, instanceId) ?? game.startUrl),
        );
    },
  });
  couch.subscribe(notifyCouch);
  couch.start();
  notifyCouch();
}
appState.subscribe(startCouch);

// --- Derived state + actions ----------------------------------------------------------------

export function ogsCastNow(): boolean {
  const cast = castStore.getSnapshot();
  return isOgsCast({
    sessionCast: couchHub.getSnapshot().state?.cast,
    castConnected: cast.session.status === "connected",
    viewIsLauncher: isLauncherView(config, cast.viewUrl),
  });
}

export const deviceId = () => appState.getSnapshot().identity?.deviceId ?? "this-phone";

export const gamePresence = createGamePresence();

/** Each game's latest page (its room), so Rejoin returns there instead of starting a new one. */
const gameUrls = createGameUrls();

/** The game screen is closing on `url` (the WebView's latest page): remember it for Rejoin. */
export function rememberGameUrl(appId: string, url: string) {
  gameUrls.record(rememberGame(appId, url, couchHub.getSnapshot().state));
}

function rejoinUrlFor(appId: string, instanceId?: string): string | undefined {
  return rejoinUrl(appId, {
    remembered: gameUrls.get(appId),
    session: couchHub.getSnapshot().state,
    pill: appState.getSnapshot().pill,
    instanceId,
  });
}

function pushGame(game: Pick<Manifest, "appId" | "name">, url: string) {
  gamePresence.opening(game.appId);
  router.push({ pathname: "/game", params: { url, name: game.name, appId: game.appId } });
}

/** A tap on a game (Library, Playing, the return pill): spec v3, Where a game plays. */
export function openGame(
  game: Manifest,
  opts: { mode?: "continue" | "new"; resumeUrl?: string } = {},
) {
  const resumeUrl = opts.resumeUrl ?? (opts.mode === "new" ? undefined : rejoinUrlFor(game.appId));
  const plan = launchPlan({
    manifest: game,
    ogsCast: ogsCastNow(),
    deviceId: deviceId(),
    mode: opts.mode,
    resumeUrl,
  });
  switch (plan.kind) {
    case "tv":
      couchHub.send(plan.start);
      pushGame(game, plan.url);
      break;
    case "phone":
      pushGame(game, plan.url);
      break;
    case "needs-tv":
      router.push({ pathname: "/game-page", params: { appId: game.appId } });
      break;
  }
}

export function openPill(pill: ReturnPill) {
  const game = appState.getSnapshot().library.find((g) => g.appId === pill.appId);
  if (game) openGame(game, { resumeUrl: pill.url });
  else router.push({ pathname: "/game", params: { url: pill.url, name: pill.name } });
}

export async function castNow(deviceIdToUse: string) {
  return castToTv({ api, config, castStore, backend: castBackend, deviceId: deviceIdToUse });
}

export async function endTonight() {
  await endForTonight({ send: couchHub.send, sessionManager: castBackend.sessionManager });
  appState.setPill(null);
}

/** The cast store a game page sees (game.view to the session while cast through OGS). */
export function gameCastStoreFor(appId: () => string | null) {
  return createGameCastStore(
    castStore,
    () => ({ ogsCast: ogsCastNow(), appId: appId() }),
    couchHub.send,
  );
}

// --- Hooks ----------------------------------------------------------------------------------

export const useApp = () =>
  useSyncExternalStore(appState.subscribe, appState.getSnapshot, appState.getSnapshot);
export const useCouch = () =>
  useSyncExternalStore(couchHub.subscribe, couchHub.getSnapshot, couchHub.getSnapshot);
export const useCast = () =>
  useSyncExternalStore(castStore.subscribe, castStore.getSnapshot, castStore.getSnapshot);

export function useOgsCast(): boolean {
  useCouch();
  useCast();
  return ogsCastNow();
}

export function usePlaying(now = Date.now()) {
  const app = useApp();
  const couchSnap = useCouch();
  const ttl = (appId: string) =>
    [...app.library, ...app.catalogue].find((g) => g.appId === appId)?.instanceTtlMs ??
    7 * 24 * 60 * 60 * 1000;
  const current = couchSnap.state?.current;
  return playingView(app.instances, {
    now,
    liveInstanceIds: current ? [current.instanceId] : [],
    ttlFor: ttl,
  });
}

/** Resolves true once the TV is cast through OGS (or false after `ms`). */
export function waitForOgsCast(ms: number): Promise<boolean> {
  if (ogsCastNow()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const check = () => {
      if (!ogsCastNow()) return;
      done(true);
    };
    const offCast = castStore.subscribe(check);
    const offCouch = couchHub.subscribe(check);
    const timer = setTimeout(() => done(false), ms);
    function done(v: boolean) {
      clearTimeout(timer);
      offCast();
      offCouch();
      resolve(v);
    }
  });
}
