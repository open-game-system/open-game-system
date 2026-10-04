import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ogs/Button";
import { GameArt } from "../components/ogs/GameArt";
import { colors, fonts } from "../components/ogs/theme";
import { castBackend, castNow, openGame, useApp, waitForOgsCast } from "../services/runtime";

/** Spec v3, tv: required and not cast: the game's page offers one-tap Cast to play. */
export default function GamePage() {
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const game = [...app.library, ...app.catalogue].find((g) => g.appId === appId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!game) return <View style={styles.root} />;

  const castToPlay = async () => {
    const tv = castBackend.getDevices()[0];
    if (!tv) {
      router.dismissTo("/tv");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await castNow(tv.id);
      if (result === "started" && (await waitForOgsCast(8000))) {
        router.back();
        openGame(game);
      } else setNote("The TV didn't answer. Try again from the TV tab.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="gamePage">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <GameArt game={game} style={styles.art} />
        <View style={[styles.body]}>
          <Text style={styles.name}>{game.name}</Text>
          {game.tagline ? <Text style={styles.tagline}>{game.tagline}</Text> : null}
          <Text style={styles.needs}>This one plays on the TV.</Text>
          <Button
            testID="castToPlay"
            label={busy ? "Casting…" : "Cast to play"}
            disabled={busy}
            onPress={() => void castToPlay()}
          />
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <Button label="Back to Library" kind="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  art: { width: "100%", aspectRatio: 4 / 3, borderRadius: 0 },
  body: { padding: 20, gap: 14 },
  name: { fontFamily: fonts.display, fontSize: 36, color: colors.cream },
  tagline: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  needs: { color: colors.cream3, fontSize: 15 },
  note: { color: colors.peach, fontSize: 15 },
});
