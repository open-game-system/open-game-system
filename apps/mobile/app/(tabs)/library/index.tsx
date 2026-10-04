import type { Manifest } from "@open-game-system/ogs-protocol";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorLine } from "../../../components/ogs/ErrorLine";
import { shelfShape } from "../../../components/ogs/library/art-kit";
import { GameCapsule } from "../../../components/ogs/library/GameCapsule";
import { LibraryHero } from "../../../components/ogs/library/LibraryHero";
import { heroAction, libraryShelves } from "../../../components/ogs/library/shelves";
import { Screen } from "../../../components/ogs/Screen";
import { colors, fonts } from "../../../components/ogs/theme";
import { appState, useApp, useCouch } from "../../../services/runtime";

const GUTTER = 20;
const GAP = 14;

/**
 * Library, Steam-style: the game you played last (or the one on the TV) as a big hero with one
 * action (Rejoin, else Start game; none when the return pill already rejoins it), then All Games:
 * every game as its cover, in a stable library order. A tap on any art opens the game's page in
 * this tab's stack.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const app = useApp();
  const { state } = useCouch();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useFocusEffect(
    useCallback(() => {
      void appState.refresh();
    }, []),
  );

  const open = (game: Manifest) =>
    router.push({ pathname: "/library/[appId]", params: { appId: game.appId } });
  const { hero, grid } = libraryShelves(app.library, app.instances, state, Date.now());
  const content = width - GUTTER * 2;
  const shape = shelfShape(grid);
  // 2:3 covers sit three across (Steam's grid); 16:9 captures two across.
  const columns = shape === "cover" ? 3 : 2;
  const gap = shape === "cover" ? 12 : GAP;
  const gridWidth = Math.floor((content - gap * (columns - 1)) / columns);

  return (
    <View style={styles.root}>
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
          <LibraryHero
            hero={hero}
            action={heroAction(hero, app.pill)}
            width={content}
            testID="libraryHero"
            onOpen={() => open(hero.game)}
          />
        ) : null}
        {grid.length > 0 ? (
          <View testID="libraryAll">
            <Text style={styles.heading} accessibilityRole="header">
              All Games
            </Text>
            <View style={[styles.grid, { gap }]}>
              {grid.map((game) => (
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
      {/* Scrolled content never runs under the clock, and fades out above the tab bar. */}
      <LinearGradient
        colors={[colors.dusk0, "rgba(18,15,34,0)"]}
        locations={[0.55, 1]}
        style={[styles.topFade, { height: insets.top + 18 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(18,15,34,0)", colors.dusk0]}
        style={styles.bottomFade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  topFade: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 28 },
  heading: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.cream,
    marginTop: 26,
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  empty: { color: colors.cream2, fontSize: 16, marginBottom: 8 },
  notice: {
    backgroundColor: colors.dusk2,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },
});
