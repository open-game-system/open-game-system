/**
 * Over-the-air updates on resume (docs/adrs/2026-10-07-beta-distribution.md). At launch the
 * native side waits up to 3 s for a new update (app.json `updates.fallbackToCacheTimeout`); this
 * catches updates published while the app sat in the background: download, then restart on it,
 * unless a cast is connected (then it loads at the next launch). Never throws.
 */
export interface OtaDeps {
  /** expo-updates is off in development builds and Expo Go. */
  isEnabled: boolean;
  check(): Promise<{ isAvailable: boolean }>;
  fetch(): Promise<{ isNew: boolean }>;
  reload(): Promise<void>;
  isCasting(): boolean;
}

export type OtaResult = "disabled" | "none" | "deferred" | "reloaded";

export async function applyWaitingUpdate(deps: OtaDeps): Promise<OtaResult> {
  if (!deps.isEnabled) return "disabled";
  try {
    if (!(await deps.check()).isAvailable) return "none";
    if (!(await deps.fetch()).isNew) return "none";
    if (deps.isCasting()) return "deferred";
    await deps.reload();
    return "reloaded";
  } catch {
    return "none";
  }
}
