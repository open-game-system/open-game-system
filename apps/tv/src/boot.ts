import type { ClientMessage, SessionState } from "@open-game-system/ogs-protocol";
import { frameTimeoutMs, type LauncherParams, wsUrl } from "./params";
import type { SessionClient } from "./session/client";
import { fetchLauncherData, type LauncherData, libraryGames } from "./session/data";
import { createFakeClient } from "./session/fake-client";
import {
  FIXTURE_GAMES,
  FIXTURE_LIBRARY,
  FIXTURE_SESSION,
  fixtureInstances,
} from "./session/fixture";
import { createWsClient } from "./session/ws-client";

declare global {
  interface Window {
    /** Set once per page load: a game swap must never change it (the stream never reloads). */
    __launcherBootId?: string;
    /** Fake mode only: drive the in-browser couch session from tests. */
    __ogsFake?: {
      send(msg: ClientMessage): void;
      state(): SessionState | null;
      connect(): void;
      drop(): void;
      restore(): void;
    };
  }
}

export interface Boot {
  client: SessionClient;
  data: Promise<LauncherData>;
  frameTimeoutMs: number;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function loadWithRetry(load: () => Promise<LauncherData>): Promise<LauncherData> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (err) {
      console.warn("[tv] launcher data failed, retrying", err);
      await wait(Math.min(10_000, 1000 * 2 ** attempt));
    }
  }
}

export function boot(params: LauncherParams, search: string): Boot {
  window.__launcherBootId ??= crypto.randomUUID();
  const timeout = frameTimeoutMs(search);
  if (params.mode === "fake") {
    const fake = createFakeClient({ hold: params.hold, fresh: params.fresh === true });
    window.__ogsFake = {
      send: (m) => fake.send(m),
      state: () => fake.getSnapshot().state,
      connect: () => fake.connect(),
      drop: () => fake.drop(),
      restore: () => fake.restore(),
    };
    const data = Promise.resolve({
      games: libraryGames(FIXTURE_GAMES, FIXTURE_LIBRARY),
      instances: params.fresh ? [] : fixtureInstances(Date.now()),
      session: FIXTURE_SESSION,
    });
    return { client: fake, data, frameTimeoutMs: timeout };
  }
  return {
    client: createWsClient({ url: wsUrl(params.api, params.token) }),
    data: loadWithRetry(() =>
      fetchLauncherData({ api: params.api, token: params.token, sessionId: params.sessionId }),
    ),
    frameTimeoutMs: timeout,
  };
}
