import type { Manifest } from "@open-game-system/ogs-protocol";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ogs/Button";
import { GameArt } from "../components/ogs/GameArt";
import { colors, fonts, TARGET } from "../components/ogs/theme";
import { appState, useApp } from "../services/runtime";

/** "+ Add games": browse the catalogue (with "Needs a TV" badges) or add any game by link. */
export default function AddGames() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const owned = new Set(app.library.map((g) => g.appId));
  const [link, setLink] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const add = async (game: Manifest) => {
    setNote(null);
    try {
      await appState.addGame(game.appId);
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  };
  const addLink = async () => {
    setNote(null);
    try {
      const game = await appState.addByLink(link.trim());
      setLink("");
      setNote(`${game.name} is in your Library.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.root} testID="addGamesScreen">
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Add games</Text>
          <Button label="Done" kind="ghost" testID="addGamesDone" onPress={() => router.back()} />
        </View>
        <Text style={styles.lead}>Every game here is a free web game.</Text>
        {app.catalogue.map((game) => (
          <View key={game.appId} style={styles.row}>
            <GameArt game={game} style={styles.art} />
            <View style={styles.text}>
              <Text style={styles.name}>{game.name}</Text>
              {game.tv === "required" ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Needs a TV</Text>
                </View>
              ) : null}
            </View>
            <Button
              testID={`addGame-${game.appId}`}
              label={owned.has(game.appId) ? "Added" : "Add"}
              kind={owned.has(game.appId) ? "ghost" : "primary"}
              disabled={owned.has(game.appId)}
              onPress={() => void add(game)}
            />
          </View>
        ))}
        <Text style={styles.section}>Add by link</Text>
        <TextInput
          testID="addByLinkInput"
          value={link}
          onChangeText={setLink}
          placeholder="https://your-game.example/ogs.json"
          placeholderTextColor={colors.cream3}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          accessibilityLabel="Game manifest link"
        />
        <Button
          testID="addByLink"
          label="Add by link"
          disabled={!link.trim()}
          onPress={() => void addLink()}
          style={{ marginTop: 12 }}
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.cream },
  lead: { color: colors.cream2, fontSize: 16, marginTop: 6, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hair,
  },
  art: { width: 84, height: 56, borderRadius: 10 },
  text: { flex: 1, gap: 4 },
  name: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.dusk3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: colors.cream, fontSize: 12, fontWeight: "700" },
  section: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.cream,
    marginTop: 28,
    marginBottom: 10,
  },
  input: {
    minHeight: TARGET + 6,
    borderRadius: 14,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    color: colors.cream,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  note: { color: colors.peach, fontSize: 15, marginTop: 12 },
});
