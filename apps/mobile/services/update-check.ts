import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Linking, Platform, AppState as RNAppState } from "react-native";
import { checkRelease, type UpdateGate } from "./app-release";
import { applyWaitingUpdate } from "./ota";
import { castStore, clientLog, config } from "./runtime";

/**
 * Keeps testers on the latest beta (docs/adrs/2026-10-07-beta-distribution.md): at launch and on
 * every return to the foreground, picks up a waiting over-the-air update and asks the API whether
 * this build is too old. The root layout shows "Update OGS" while the gate says "update".
 */
async function runChecks(): Promise<UpdateGate> {
  const ota = await applyWaitingUpdate({
    isEnabled: Updates.isEnabled,
    check: () => Updates.checkForUpdateAsync(),
    fetch: () => Updates.fetchUpdateAsync(),
    reload: () => Updates.reloadAsync(),
    isCasting: () => castStore.getSnapshot().session.status !== "disconnected",
  });
  if (ota !== "disabled" && ota !== "none") {
    clientLog.event("app.ota", { data: { result: ota } });
  }
  const gate = await checkRelease({
    apiBase: config.apiBase,
    platform: Platform.OS,
    installedBuild: Application.nativeBuildVersion,
    fetch: (url) => fetch(url),
  });
  if (gate.kind === "update") {
    clientLog.event("app.update_required", { data: { build: Application.nativeBuildVersion } });
  }
  return gate;
}

export function useUpdateGate(): UpdateGate {
  const [gate, setGate] = useState<UpdateGate>({ kind: "ok" });
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void runChecks().then((next) => {
        if (!cancelled) setGate(next);
      });
    };
    run();
    const sub = RNAppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  return gate;
}

export function openUpdate(url: string): void {
  void Linking.openURL(url);
}
