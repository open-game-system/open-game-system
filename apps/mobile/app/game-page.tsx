import type { Manifest } from "@open-game-system/ogs-protocol";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ogs/Button";
import { GameArt } from "../components/ogs/GameArt";
import { SectionTitle } from "../components/ogs/Screen";
import { colors, fonts, TARGET } from "../components/ogs/theme";
import {
  castBackend,
  castNow,
  openGame,
  useApp,
  useCouch,
  useOgsCast,
  waitForOgsCast,
} from "../services/runtime";
import { playedAgo, type Sitting, sittingsFor } from "../services/sittings";
import { userMessage } from "../services/user-message";

/**
 * A game's page (a tap in Library): the game, your in-progress sittings of it (each with its own
 * Rejoin: two games of Catan are two rows), then New game. Spec v3, tv: required and not cast: the
 * page offers one-tap Cast to play instead, and a Rejoin casts first.
 */
export default function GamePage() {
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const { state } = useCouch();
  const cast = useOgsCast();
  const game = [...app.library, ...app.catalogue].find((g) => g.appId === appId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!game) return <View style={styles.root} />;

  const needsCast = game.tv === "required" && !cast;
  const sittings = sittingsFor(game, app.instances, state, Date.now());

  /** Casts to the first TV, then runs `play` once the TV is the OGS launcher. */
  const castThen = async (play: () => void) => {
    const tv = castBackend.getDevices()[0];
    if (!tv) {
      router.dismissTo("/tv");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await castNow(tv);
      if (result === "started" && (await waitForOgsCast(8000))) play();
      else setNote("The TV didn't answer. Try again from the TV tab.");
    } catch (err) {
      setNote(userMessage(err, "cast").text);
    } finally {
      setBusy(false);
    }
  };
  const play = (start: () => void) => (needsCast ? void castThen(start) : start());
  const rejoin = (s: Sitting) =>
    play(() =>
      openGame(game, { mode: "continue", resumeUrl: s.resumeUrl, instanceId: s.instanceId }),
    );
  const startNew = () => play(() => openGame(game, { mode: "new" }));

  return (
    <View style={styles.root} testID="gamePage">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <GameArt game={game} style={styles.art} />
        <View style={styles.body}>
          <Text style={styles.name}>{game.name}</Text>
          {game.tagline ? <Text style={styles.tagline}>{game.tagline}</Text> : null}

          {sittings.length > 0 ? (
            <View testID="gameSittings">
              <SectionTitle>In progress</SectionTitle>
              {sittings.map((s) => (
                <SittingRow
                  key={s.instanceId}
                  sitting={s}
                  game={game}
                  disabled={busy}
                  onRejoin={() => rejoin(s)}
                />
              ))}
            </View>
          ) : null}

          {needsCast ? (
            <>
              <Text style={styles.needs}>This one plays on the TV.</Text>
              <Button
                testID="castToPlay"
                label={busy ? "Casting…" : "Cast to play"}
                disabled={busy}
                onPress={startNew}
              />
            </>
          ) : (
            <Button testID="gameNew" label="New game" disabled={busy} onPress={startNew} />
          )}
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <Button
            testID="gamePageBack"
            label="Back to Library"
            kind="ghost"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SittingRow({
  sitting,
  game,
  disabled,
  onRejoin,
}: {
  sitting: Sitting;
  game: Manifest;
  disabled: boolean;
  onRejoin: () => void;
}) {
  const title = sitting.live ? "On the TV now" : sitting.label || "In progress";
  const when = sitting.live ? sitting.label : playedAgo(sitting.at, Date.now());
  return (
    <View style={styles.sitting} testID={`gameSitting-${sitting.instanceId}`}>
      <View style={styles.sittingText}>
        <Text style={styles.sittingTitle} numberOfLines={1}>
          {title}
        </Text>
        {when ? (
          <Text style={styles.sittingWhen} numberOfLines={1}>
            {when}
          </Text>
        ) : null}
      </View>
      <Pressable
        testID={`gameSittingRejoin-${sitting.instanceId}`}
        accessibilityRole="button"
        accessibilityLabel={`Rejoin ${game.name}, ${title}${when ? `, ${when}` : ""}`}
        disabled={disabled}
        onPress={onRejoin}
        style={({ pressed }) => [styles.rejoin, (pressed || disabled) && { opacity: 0.7 }]}
      >
        <Text style={styles.rejoinText}>Rejoin</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  art: { width: "100%", aspectRatio: 16 / 10, borderRadius: 0 },
  body: { padding: 20, gap: 14 },
  name: { fontFamily: fonts.display, fontSize: 36, color: colors.cream },
  tagline: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  needs: { color: colors.cream3, fontSize: 15 },
  note: { color: colors.peach, fontSize: 15 },
  sitting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: TARGET + 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hair,
  },
  sittingText: { flex: 1, minWidth: 0 },
  sittingTitle: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  sittingWhen: { color: colors.cream3, fontSize: 14, marginTop: 2 },
  rejoin: {
    minHeight: TARGET,
    paddingHorizontal: 18,
    borderRadius: TARGET / 2,
    backgroundColor: colors.lamp,
    alignItems: "center",
    justifyContent: "center",
  },
  rejoinText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
});
