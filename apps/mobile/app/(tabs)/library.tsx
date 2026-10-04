import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ogs/Button";
import { GameTile } from "../../components/ogs/GameTile";
import { Screen } from "../../components/ogs/Screen";
import { StickerRow } from "../../components/ogs/Sticker";
import { colors, TARGET } from "../../components/ogs/theme";
import { gameStatusLine } from "../../services/library-view";
import { appState, openGame, useApp, useCouch } from "../../services/runtime";

/** Spec v3: Library is your games (art tiles with each one's status), plus "+ Add games". */
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
  const rows: (typeof app.library)[] = [];
  for (let i = 0; i < app.library.length; i += 2) rows.push(app.library.slice(i, i + 2));

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
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row.map((g) => g.appId).join()} style={styles.row}>
            {row.map((game) => (
              <GameTile
                key={game.appId}
                testID={`libraryGame-${game.appId}`}
                game={game}
                status={gameStatusLine(game, app.instances, state, now)}
                onPress={() => openGame(game)}
              />
            ))}
            {row.length === 1 ? <View style={styles.spacer} /> : null}
          </View>
        ))}
      </View>
      {app.library.length === 0 && app.status === "ready" ? (
        <Text style={styles.empty}>Add your first game: they're free web games.</Text>
      ) : null}
      <Button
        testID="addGames"
        label="+ Add games"
        kind="ghost"
        style={styles.add}
        onPress={() => router.push("/add-games")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 22 },
  row: { flexDirection: "row", gap: 14 },
  spacer: { flex: 1 },
  add: { marginTop: 28 },
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
