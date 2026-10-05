import type { ClientMessage, Manifest } from "@open-game-system/ogs-protocol";
import { playingView } from "@open-game-system/ogs-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { createAppState } from "./app-state";
import type { CastBackend } from "./cast-backend";
import { castToTv, createGameCastStore, endForTonight, switchTv } from "./cast-flow";
import { createCastStop } from "./cast-stop";
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
import { createGameProfile, createGameTokenClient } from "./game-profile";
import { createGameUrls, rejoinUrl, rememberGame } from "./game-rejoin";
import { createGoogleCastBackend } from "./google-cast-backend";
import { launchPlan } from "./launch-plan";
import type { ReturnPill } from "./leave-game";
import { createOgsApi } from "./ogs-api";
import { sittingToOpen } from "./sittings";

/**
 * The app's singletons, wired once for its lifetime: config, cast backend (real or fake) and the
 * cast store kept in step with it, the OGS API, the app data store, and the couch session (open
 * while this device hosts or joined a cast). Screens read them through the hooks at the bottom.
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
  return id ? { token: id.deviceToken } : null;
};

export const api = createOgsApi({ baseUrl: config.apiBase, fetch: fetchImpl, auth });

/** The game WebView's `profile` store: a token for the open game only (slice 3). */
export const gameProfile = createGameProfile({
  fetchToken: createGameTokenClient({ baseUrl: config.apiBase, fetch: fetchImpl, auth }),
});

/** App storage (wiped with the app), unlike the Keychain behind SecureStore. */
const INSTALLED_KEY = "@ogs/installed";

export const appState = createAppState({
  api,
  storage: SecureStore,
  device: {
    kind: Device.deviceType === Device.DeviceType.TABLET ? "tablet" : "phone",
    name: Device.deviceName ?? "Phone",
  },
  newDeviceId: () => Crypto.randomUUID(),
  install: {
    isFirstLaunch: async () => (await AsyncStorage.getItem(INSTALLED_KEY)) !== "true",
    markLaunched: () => AsyncStorage.setItem(INSTALLED_KEY, "true"),
  },
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

let couchKey: string | null = null;

/** One couch socket per (profile token, session): opened on cast or join, closed on leave. */
function syncCouch() {
  const { identity: id, session } = appState.getSnapshot();
  const key = id && session ? `${id.deviceToken} ${session.sessionId}` : null;
  if (key === couchKey) return;
  couchKey = key;
  couch?.stop();
  couch = null;
  if (id && session) startCouch(id.deviceToken, id.deviceId, session.sessionId);
  notifyCouch();
}

function startCouch(token: string, deviceIdOfMine: string, sessionId: string) {
  couch = createCouchSession({
    url: couchSocketUrl(config.apiBase, token, sessionId),
    deviceId: deviceIdOfMine,
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
}
appState.subscribe(syncCouch);

// --- Derived state + actions ----------------------------------------------------------------

export function ogsCastNow(): boolean {
  const cast = castStore.getSnapshot();
  return isOgsCast({
    sessionCast: couchHub.getSnapshot().state?.cast,
    castConnected: cast.session.status === "connected",
    viewIsLauncher: isLauncherView(config, cast.viewUrl),
  });
}

/** Stop casting as the phone shows it: done at the confirm, not when the TV's reply comes back. */
export const castStop = createCastStop({ isCast: ogsCastNow });
castStore.subscribe(() => castStop.castChanged());
couchHub.subscribe(() => castStop.castChanged());

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

function pushGame(game: Pick<Manifest, "appId" | "name">, url: string, instanceId?: string) {
  gamePresence.opening(game.appId);
  router.push({
    pathname: "/game",
    params: { url, name: game.name, appId: game.appId, ...(instanceId ? { instanceId } : {}) },
  });
}

/**
 * A tap on a game (a game's page, Playing, the return pill): spec v3, Where a game plays.
 * `instanceId` names one sitting to rejoin (a game's page lists several).
 */
export function openGame(
  game: Manifest,
  opts: { mode?: "continue" | "new"; resumeUrl?: string; instanceId?: string } = {},
) {
  const isNew = opts.mode === "new";
  const resumeUrl =
    opts.resumeUrl ?? (isNew ? undefined : rejoinUrlFor(game.appId, opts.instanceId));
  const instanceId = isNew ? undefined : opts.instanceId;
  const plan = launchPlan({
    manifest: game,
    ogsCast: ogsCastNow(),
    deviceId: deviceId(),
    mode: opts.mode,
    resumeUrl,
    instanceId,
  });
  const sitting = sittingToOpen(game.appId, { instanceId, resumeUrl }, Date.now());
  switch (plan.kind) {
    case "tv":
      couchHub.send(plan.start);
      pushGame(game, plan.url, sitting);
      break;
    case "phone":
      pushGame(game, plan.url, sitting);
      break;
    case "needs-tv":
      router.push({ pathname: "/library/[appId]", params: { appId: game.appId } });
      break;
  }
}

export function openPill(pill: ReturnPill) {
  const game = appState.getSnapshot().library.find((g) => g.appId === pill.appId);
  if (game) openGame(game, { resumeUrl: pill.url, instanceId: pill.instanceId });
  else router.push({ pathname: "/game", params: { url: pill.url, name: pill.name } });
}

/** Cast: a new couch session hosted by this profile, named for the TV. */
export async function castNow(tv: { id: string; name: string }) {
  castStop.reset();
  const launcher = { launcherToken: () => appState.startSession(tv.name) };
  return castToTv({ api: launcher, config, castStore, backend: castBackend, deviceId: tv.id });
}

/** Remote → TV picker: the same session (its launcher token) moves to another TV. */
export async function moveToTv(tv: { id: string; name: string }) {
  const launcher = {
    launcherToken: async () =>
      appState.getSnapshot().session?.launcherToken ?? appState.startSession(tv.name),
  };
  return switchTv({ api: launcher, config, castStore, backend: castBackend, deviceId: tv.id });
}

/** Remote → Stop casting: the TV tab shows the Cast screen at once (castStop), then the cast ends. */
export function endTonight() {
  return castStop.stop(async () => {
    const result = await endForTonight({
      send: couchHub.send,
      sessionManager: castBackend.sessionManager,
    });
    appState.setPill(null);
    await appState.leaveSession();
    return result;
  });
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

export const useCastStopping = () =>
  useSyncExternalStore(castStop.subscribe, castStop.isStopping, castStop.isStopping);

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
