import { type AirplayCastBackend, createAirplayCastBackend } from "./airplay-cast";
import type { AirplayDisplay, NativeLogSource } from "./airplay-display";
import type { FetchLike } from "./api-request";
import { type ClientLog, clientEventsSender, createClientLog } from "./client-log";
import { forwardNativeLog } from "./native-log-forward";
import type { ShellContext } from "./shell-runtime";

/** The slice of expo-notifications the "keep the app open" notice needs. */
export interface LocalNotifications {
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  scheduleNotificationAsync(request: {
    content: { title: string; body: string };
    trigger: null;
  }): Promise<unknown>;
}

type AppStateLike = {
  addEventListener(type: "change", listener: (state: string) => void): { remove(): void };
};

export interface ShellAirplayDeps {
  display: AirplayDisplay;
  nativeLog: NativeLogSource;
  fetch: FetchLike;
  now: () => number;
  /** A random id (the launch id). */
  newId: () => string;
  platform: string;
  version?: string;
  build?: string;
  appState: AppStateLike;
  notifications: LocalNotifications;
  /** How long events wait before a batch is sent (default 5 s). */
  flushMs?: number;
}

/**
 * A game's own app with `cast.airplay` on: the AirPlay TV backend, plus the client log for it
 * (docs/agents/client-log.md). The shell has no client log of its own otherwise, so this one carries
 * the AirPlay steps and every native event, as `app: "shell"` with the game's appId and one
 * launch id, under the shell profile's token. While casting, going to the background schedules
 * "Open <app> to keep the TV going" (the TV window shows the same notice).
 */
export function shellAirplay(deps: ShellAirplayDeps) {
  return (ctx: ShellContext): AirplayCastBackend => {
    const launchId = `launch-${deps.newId()}`;
    const log: ClientLog = createClientLog({
      send: clientEventsSender({
        baseUrl: ctx.config.apiBase,
        fetch: deps.fetch,
        auth: () => {
          const id = ctx.getIdentity();
          return id ? { token: id.deviceToken } : null;
        },
      }),
      context: () => ({
        app: "shell",
        appId: ctx.config.appId,
        launchId,
        platform: deps.platform,
        ...(deps.version ? { version: deps.version } : {}),
        ...(deps.build ? { build: deps.build } : {}),
      }),
      now: deps.now,
      ...(deps.flushMs ? { flushMs: deps.flushMs } : {}),
    });
    const stopForward = forwardNativeLog(deps.nativeLog, log);
    const name = ctx.config.name;
    const backend = createAirplayCastBackend({
      display: deps.display,
      sheet: ctx.airplaySheet,
      appName: name,
      log: (event, data, level) => log.event(event, { level, data }),
      appState: deps.appState,
      async notifyAway() {
        const { granted } = await deps.notifications.getPermissionsAsync();
        if (!granted) return;
        await deps.notifications.scheduleNotificationAsync({
          content: { title: name, body: `Open ${name} to keep the TV going` },
          trigger: null,
        });
      },
    });
    const flushOnBackground = deps.appState.addEventListener("change", (state) => {
      if (state === "background") void log.flush();
    });
    // Events before the guest profile exists wait for it.
    const offIdentity = ctx.onIdentity(() => void log.flush());
    return {
      ...backend,
      dispose() {
        backend.dispose();
        stopForward();
        flushOnBackground.remove();
        offIdentity();
        void log.flush();
      },
    };
  };
}
