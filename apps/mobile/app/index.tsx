import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../components/ogs/theme";
import { DEFAULT_FAMILY } from "../services/identity";
import { isOnboardingComplete } from "../services/onboarding";
import { decideOpeningTab, type TabName } from "../services/opening-tab";
import { appState, couchHub, deviceId } from "../services/runtime";

const SESSION_WAIT_MS = 1500;

/**
 * Cold start (spec v3, App structure): first run → onboarding; otherwise open Playing only when a
 * game this phone was playing is still live, else Library. Coming back from the background never
 * lands here, so the place is kept.
 */
export default function Index() {
  const [target, setTarget] = useState<"onboarding" | TabName | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await isOnboardingComplete())) {
        if (!cancelled) setTarget("onboarding");
        return;
      }
      await appState.init();
      // Onboarded before households existed (or never reached OGS): set one up with defaults.
      if (!appState.getSnapshot().identity)
        await appState.ensureHousehold(
          "Our family",
          DEFAULT_FAMILY.map((p) => ({ ...p })),
        );
      void appState.refresh();
      const tab = appState.getSnapshot().identity
        ? await decideOpeningTab(couchHub, deviceId(), SESSION_WAIT_MS)
        : "library";
      if (!cancelled) setTarget(tab);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (target === "onboarding") return <Redirect href="/onboarding" />;
  if (target) return <Redirect href={`/${target}`} />;
  return (
    <View style={styles.root} testID="launching">
      <ActivityIndicator color={colors.cream3} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0, alignItems: "center", justifyContent: "center" },
});
