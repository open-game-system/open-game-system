import type { Manifest } from "@open-game-system/ogs-protocol";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ErrorLine } from "../../../components/ogs/ErrorLine";
import { shelfShape } from "../../../components/ogs/library/art-kit";
import { GameCapsule } from "../../../components/ogs/library/GameCapsule";
import { LibraryHero } from "../../../components/ogs/library/LibraryHero";
import { libraryShelves } from "../../../components/ogs/library/shelves";
import { Screen, SectionTitle } from "../../../components/ogs/Screen";
import { colors } from "../../../components/ogs/theme";
import { appState, useApp, useCouch } from "../../../services/runtime";

const GUTTER = 20;
const GAP = 14;

/**
 * Library, Steam-style: the game you played last (or the one on the TV) as a big hero with one
 * action (Rejoin, else Start game), then All Games as a grid of art, played newest first. A tap on
 * any art opens the game's page in this tab's stack (its sittings, Start game).
 */
export default function LibraryScreen() {
  const router = useRouter();
  const app = useApp();
  const { state } = useCouch();
  const { width } = useWindowDimensions();
  useFocusEffect(
    useCallback(() => {
      void appState.refresh();
    }, []),
  );

  const open = (game: Manifest) =>
    router.push({ pathname: "/library/[appId]", params: { appId: game.appId } });
  const { hero, all } = libraryShelves(app.library, app.instances, state, Date.now());
  const content = width - GUTTER * 2;
  const gridWidth = (content - GAP) / 2;
  const shape = shelfShape(all);

  return (
    <Screen title="Library" testID="libraryScreen">
      {app.error && app.status !== "ready" ? (
        <View style={styles.notice} testID="libraryOffline">
          <ErrorLine
            text={app.error.text}
            action={app.error.action}
            onRetry={() => void appState.init().then(appState.refresh)}
          />
        </View>
      ) : null}
      {hero ? (
        <View style={styles.heroLayer}>
          <LibraryHero hero={hero} testID="libraryHero" onOpen={() => open(hero.game)} />
        </View>
      ) : null}
      {all.length > 0 ? (
        <View testID="libraryAll">
          <SectionTitle>All Games</SectionTitle>
          <View style={styles.grid}>
            {all.map((game) => (
              <GameCapsule
                key={game.appId}
                testID={`libraryGame-${game.appId}`}
                game={game}
                shape={shape}
                width={gridWidth}
                onPress={() => open(game)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {app.library.length === 0 && app.status === "ready" ? (
        <Text style={styles.empty}>No games yet.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The hero's blurred art tints the page behind the title.
  heroLayer: { zIndex: -1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, rowGap: 18 },
  empty: { color: colors.cream2, fontSize: 16, marginBottom: 8 },
  notice: {
    backgroundColor: colors.dusk2,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },
});
