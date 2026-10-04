import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ogs/Button";
import { LibraryRow } from "../../components/ogs/library/LibraryRow";
import { needsTv } from "../../components/ogs/library/needs-tv";
import { Screen } from "../../components/ogs/Screen";
import { colors } from "../../components/ogs/theme";
import { appState, useApp } from "../../services/runtime";

/**
 * Library is the games you have, one per row (art, name, tagline, "Needs a TV"). A tap opens the
 * game's page, which lists your sittings of it and starts a new one.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const app = useApp();
  useFocusEffect(
    useCallback(() => {
      void appState.refresh();
    }, []),
  );

  return (
    <Screen title="Library" testID="libraryScreen">
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
            needsTv={needsTv(game)}
            onPress={() => router.push({ pathname: "/game-page", params: { appId: game.appId } })}
          />
        ))}
        {app.library.length === 0 && app.status === "ready" ? (
          <Text style={styles.empty}>No games yet.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { color: colors.cream2, fontSize: 16, marginBottom: 8 },
  notice: {
    backgroundColor: colors.dusk2,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },
  noticeText: { color: colors.cream2, fontSize: 15, lineHeight: 21 },
});
