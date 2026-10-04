import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ogs/Button";
import { AddGamesRow } from "../../components/ogs/library/AddGamesRow";
import { LibraryRow } from "../../components/ogs/library/LibraryRow";
import { needsTv, rowAffordance } from "../../components/ogs/library/row-affordance";
import { Screen } from "../../components/ogs/Screen";
import { StickerRow } from "../../components/ogs/Sticker";
import { colors, TARGET } from "../../components/ogs/theme";
import { gameStatusLine } from "../../services/library-view";
import { appState, openGame, useApp, useCouch } from "../../services/runtime";

/** Spec v3: Library is your games, one per row (art, name, status), ending in "+ Add games". */
export default function LibraryScreen() {
  const router = useRouter();
  const app = useApp();
  const { state } = useCouch();
  useFocusEffect(
    useCallback(() => {
      void appState.refresh();
    }, []),
  );
  const now = Date.now();

  return (
    <Screen
      title="Library"
      testID="libraryScreen"
      right={
        <Pressable
          testID="householdButton"
          accessibilityRole="button"
          accessibilityLabel="Household and settings"
          onPress={() => router.push("/settings")}
          style={styles.household}
        >
          <StickerRow ids={app.identity?.people.map((p) => p.sticker) ?? ["bear"]} size={30} />
          <Text style={styles.householdName} numberOfLines={1}>
            {app.identity?.householdName ?? "Settings"}
          </Text>
        </Pressable>
      }
    >
      {app.error && app.status !== "ready" ? (
        <View style={styles.notice} testID="libraryOffline">
          <Text style={styles.noticeText}>
            Can't reach OGS right now. Your games will be back soon.
          </Text>
          <Button
            label="Try again"
            kind="ghost"
            onPress={() => void appState.init().then(appState.refresh)}
          />
        </View>
      ) : null}
      <View style={styles.list}>
        {app.library.map((game) => (
          <LibraryRow
            key={game.appId}
            testID={`libraryGame-${game.appId}`}
            game={game}
            status={gameStatusLine(game, app.instances, state, now)}
            affordance={rowAffordance(game, {
              instances: app.instances,
              session: state,
              pillAppId: app.pill?.appId ?? null,
              now,
            })}
            needsTv={needsTv(game)}
            onPress={() => openGame(game)}
          />
        ))}
        {app.library.length === 0 && app.status === "ready" ? (
          <Text style={styles.empty}>Add your first game: they're free web games.</Text>
        ) : null}
        <AddGamesRow testID="addGames" onPress={() => router.push("/add-games")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { color: colors.cream2, fontSize: 16, marginBottom: 8 },
  household: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: TARGET,
    maxWidth: 190,
  },
  householdName: { color: colors.cream, fontWeight: "700", fontSize: 15, flexShrink: 1 },
  notice: {
    backgroundColor: colors.dusk2,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },
  noticeText: { color: colors.cream2, fontSize: 15, lineHeight: 21 },
});
