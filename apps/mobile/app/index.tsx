import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../components/ogs/theme";
import { decideOpeningTab, type TabName } from "../services/opening-tab";
import { appState, couchHub, deviceId } from "../services/runtime";

const SESSION_WAIT_MS = 1500;

/**
 * Cold start (spec v3, App structure): no profile on this device → onboarding (it makes or signs
 * in to one); otherwise open Playing only when a game this device was playing is still live, else
 * Library. Coming back from the background never
 * lands here, so the place is kept.
 */
export default function Index() {
  const [target, setTarget] = useState<"onboarding" | TabName | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await appState.init();
      if (!appState.getSnapshot().identity) {
        if (!cancelled) setTarget("onboarding");
        return;
      }
      void appState.refresh();
      const tab = await decideOpeningTab(couchHub, deviceId(), SESSION_WAIT_MS);
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
