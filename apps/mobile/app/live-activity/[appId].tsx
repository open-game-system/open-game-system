import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { colors } from "../../components/ogs/theme";
import { liveActivityStep } from "../../services/live-activity-link";
import { appState, gamePresence, openGame } from "../../services/runtime";

/**
 * A tap on the controller's Live Activity (opengame://live-activity/<appId>): back to the game's
 * controller as it was, or open it (its rejoin page) when the app wasn't on it.
 */
export default function LiveActivityLinkScreen() {
  const router = useRouter();
  const { appId } = useLocalSearchParams<{ appId: string }>();

  useEffect(() => {
    let live = true;
    void appState.init().then(() => {
      if (!live) return;
      const { library, catalogue } = appState.getSnapshot();
      const find = (id: string) => [...library, ...catalogue].find((g) => g.appId === id);
      const step = liveActivityStep(appId, {
        openApp: gamePresence.openApp(),
        canGoBack: router.canGoBack(),
        knows: (id) => find(id) !== undefined,
      });
      if (step.kind === "back") {
        router.back();
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace("/");
      const game = step.kind === "open" ? find(step.appId) : undefined;
      if (game) openGame(game);
    });
    return () => {
      live = false;
    };
  }, [appId, router]);

  return <View style={{ flex: 1, backgroundColor: colors.dusk0 }} testID="liveActivityLink" />;
}
