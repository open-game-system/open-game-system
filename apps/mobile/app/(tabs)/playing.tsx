import type { Instance, Manifest, SectionKind } from "@open-game-system/ogs-protocol";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ogs/Button";
import { GameArt } from "../../components/ogs/GameArt";
import { GameTile } from "../../components/ogs/GameTile";
import { Screen, SectionTitle } from "../../components/ogs/Screen";
import { colors, fonts, TARGET } from "../../components/ogs/theme";
import { gameStatusLine, playingSuggestions } from "../../services/library-view";
import {
  appState,
  openGame,
  useApp,
  useCouch,
  useOgsCast,
  usePlaying,
} from "../../services/runtime";

const TITLES: Record<SectionKind, string> = {
  yourTurn: "Your turn",
  tonight: "Tonight",
  paused: "Paused",
  waiting: "Waiting on them",
  finished: "Finished",
};

/** Spec v3: everything in flight, the live game pinned on top, then what needs you. */
export default function PlayingScreen() {
  const app = useApp();
  const { state } = useCouch();
  const cast = useOgsCast();
  const view = usePlaying();
  useFocusEffect(
    useCallback(() => {
      void appState.refresh();
    }, []),
  );
  const games = [...app.library, ...app.catalogue];
  const find = (appId: string) => games.find((g) => g.appId === appId);
  const current = state?.current;
  const liveGame = current ? find(current.appId) : undefined;
  const empty = !current && view.sections.length === 0;

  return (
    <Screen title="Playing" testID="playingScreen">
      {current && liveGame ? (
        <View style={styles.live} testID="nowPlaying">
          <GameArt game={liveGame} style={styles.liveArt} />
          <View style={styles.liveBody}>
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTagText}>Now playing · on the TV</Text>
            </View>
            <Text style={styles.liveName}>{liveGame.name}</Text>
            {current.label ? <Text style={styles.liveLabel}>{current.label}</Text> : null}
            <Button
              testID="nowPlayingBackIn"
              label="Rejoin"
              onPress={() => openGame(liveGame)}
              style={styles.liveButton}
            />
          </View>
        </View>
      ) : null}

      {view.sections.map((section) => (
        <View key={section.kind} testID={`playingSection-${section.kind}`}>
          <SectionTitle count={section.kind === "yourTurn" ? section.items.length : undefined}>
            {TITLES[section.kind]}
          </SectionTitle>
          {section.items.map((item) => (
            <InstanceRow key={item.instanceId} item={item} game={find(item.appId)} />
          ))}
        </View>
      ))}

      {empty ? <EmptyPlaying library={app.library} instances={app.instances} cast={cast} /> : null}
    </Screen>
  );
}

function InstanceRow({ item, game }: { item: Instance; game: Manifest | undefined }) {
  const label = [game?.name ?? item.appId, item.detail].filter(Boolean).join(" · ");
  return (
    <Pressable
      testID={`playingItem-${item.instanceId}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.title || game?.name || item.appId}, ${label}`}
      disabled={!game}
      onPress={() =>
        game && openGame(game, { mode: "continue", resumeUrl: item.resumeUrl ?? undefined })
      }
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      {game ? <GameArt game={game} style={styles.rowArt} /> : <View style={styles.rowArt} />}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title || game?.name || item.appId}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function EmptyPlaying({
  library,
  instances,
  cast,
}: {
  library: Manifest[];
  instances: Instance[];
  cast: boolean;
}) {
  const router = useRouter();
  const picks = playingSuggestions(library, instances, cast);
  const rows: Manifest[][] = [];
  for (let i = 0; i < picks.length; i += 2) rows.push(picks.slice(i, i + 2));
  return (
    <View testID="playingEmpty">
      <Text style={styles.emptyLead}>
        {cast
          ? "On the TV · your games. Pick one to start."
          : "Nothing in flight. Start something tonight:"}
      </Text>
      <View style={styles.picks}>
        {rows.map((row) => (
          <View key={row.map((g) => g.appId).join()} style={styles.pickRow}>
            {row.map((game) => (
              <GameTile
                key={game.appId}
                testID={`playingSuggestion-${game.appId}`}
                game={game}
                status={gameStatusLine(game, instances, null, Date.now())}
                onPress={() => openGame(game)}
              />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
      {cast ? null : (
        <Button
          testID="playingCast"
          label="Cast to the TV"
          kind="ghost"
          style={{ marginTop: 24 }}
          onPress={() => router.navigate("/tv")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  live: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  liveArt: { width: "100%", aspectRatio: 16 / 9, borderRadius: 0 },
  liveBody: { padding: 16, gap: 6 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ember },
  liveTagText: { color: colors.cream2, fontSize: 14, fontWeight: "700" },
  liveName: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  liveLabel: { color: colors.cream2, fontSize: 16 },
  liveButton: { marginTop: 8, alignSelf: "flex-start" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: TARGET + 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hair,
  },
  rowArt: { width: 72, height: 48, borderRadius: 10, backgroundColor: colors.dusk2 },
  rowText: { flex: 1 },
  rowTitle: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  rowSub: { color: colors.cream3, fontSize: 14, marginTop: 2 },
  chevron: { color: colors.cream3, fontSize: 26 },
  emptyLead: { color: colors.cream2, fontSize: 17, marginBottom: 16, lineHeight: 24 },
  picks: { gap: 22 },
  pickRow: { flexDirection: "row", gap: 14 },
});
