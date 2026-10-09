import type { PushConsentResult } from "@open-game-system/ogs-protocol";

export interface GameNotificationRow {
  appId: string;
  name: string;
  on: boolean;
}

/**
 * Settings → Game notifications (spec §9): the games this profile allows, each with a switch.
 * Off revokes the game; on opts in again (same handle). A game stays listed until the screen closes.
 */
export function createGameNotificationSettings(deps: {
  api: {
    grantedGames(): Promise<string[]>;
    revoke(appId: string): Promise<void>;
    optIn(appId: string): Promise<PushConsentResult>;
  };
  nameOf: (appId: string) => string;
}) {
  let rows: GameNotificationRow[] = [];
  return {
    async load(): Promise<GameNotificationRow[]> {
      const games = await deps.api.grantedGames();
      rows = games
        .map((appId) => ({ appId, name: deps.nameOf(appId), on: true }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return rows;
    },
    async set(appId: string, on: boolean): Promise<GameNotificationRow[]> {
      if (!rows.some((r) => r.appId === appId)) return rows;
      const now = on
        ? (await deps.api.optIn(appId)).status === "granted"
        : (await deps.api.revoke(appId), false);
      rows = rows.map((r) => (r.appId === appId ? { ...r, on: now } : r));
      return rows;
    },
  };
}
