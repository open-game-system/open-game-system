import type { Manifest } from "@open-game-system/ogs-protocol";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { artUrl } from "../../../components/ogs/GameArt";
import { artKit } from "../../../components/ogs/library/art-kit";
import { gameFacts } from "../../../components/ogs/library/game-facts";
import { GameLogo, KeyArt } from "../../../components/ogs/library/KeyArt";
import { sittingTitles } from "../../../components/ogs/library/sitting-title";
import { usePlay } from "../../../components/ogs/library/use-play";
import { SectionTitle } from "../../../components/ogs/Screen";
import { colors, fonts, TARGET } from "../../../components/ogs/theme";
import { useApp, useCouch } from "../../../services/runtime";
import { type Sitting, sittingsFor } from "../../../services/sittings";

/**
 * A game's page, in the Library tab's stack (the tab bar stays): the art with the name set on it and
 * the page tinted by it, your in-progress sittings as cards (two games of Catan are two cards), and
 * one primary action pinned at the bottom in thumb reach: Rejoin the newest sitting (Start game
 * under it), else Start game. Spec v3, tv: required and not cast: Cast to play instead, every card
 * keeps its own Rejoin, and a Rejoin casts first.
 */
export default function GamePage() {
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const app = useApp();
  const game = [...app.library, ...app.catalogue].find((g) => g.appId === appId);

  if (!game) return <View style={styles.root} />;
  return <GamePageBody game={game} />;
}

function GamePageBody({ game }: { game: Manifest }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const { state } = useCouch();
  const { busy, note, needsCast, rejoin, startNew } = usePlay(game);
  const { width, height } = useWindowDimensions();
  const now = Date.now();
  const sittings = sittingsFor(game, app.instances, state, now);
  const titles = sittingTitles(sittings, game.appId, now);
  // Big art when there's nothing else to show; shorter when sittings need the room.
  const artHeight = Math.round(height * (sittings.length > 0 ? 0.38 : 0.5));
  const kit = artKit(game);
  const facts = gameFacts(game.shop);
  // The newest sitting's Rejoin is the page's primary action, unless the TV has to be cast first.
  const next = needsCast ? null : (sittings[0] ?? null);
  const nextTitle = next ? titles[0] : null;

  return (
    <View style={styles.root} testID="gamePage">
      <StatusBar style="light" />
      <View style={styles.ambient} pointerEvents="none">
        <Image
          source={{ uri: artUrl(kit.heroClean ?? kit.hero) }}
          style={styles.ambientArt}
          blurRadius={50}
        />
        <LinearGradient
          colors={["rgba(18,15,34,0.2)", colors.dusk0]}
          locations={[0.1, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View>
          <KeyArt game={game} width={width} height={artHeight} />
          <LinearGradient
            colors={["rgba(18,15,34,0.7)", "rgba(18,15,34,0)"]}
            style={[styles.topScrim, { height: insets.top + 56 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(18,15,34,0)", colors.dusk0]}
            locations={[0, 0.9]}
            style={styles.bottomScrim}
            pointerEvents="none"
          />
          <View style={styles.caption}>
            <GameLogo
              game={game}
              width={width * 0.62}
              height={artHeight * 0.32}
              nameStyle={styles.name}
            />
            {facts.length > 0 ? (
              <Text style={styles.facts} numberOfLines={1}>
                {facts.join("  ·  ")}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {game.tagline ? <Text style={styles.tagline}>{game.tagline}</Text> : null}
          {sittings.length > 0 ? (
            <View testID="gameSittings" style={styles.sittings}>
              <SectionTitle>In progress</SectionTitle>
              {sittings.map((s, i) => (
                <SittingCard
                  key={s.instanceId}
                  sitting={s}
                  title={titles[i]}
                  game={game}
                  next={s === next}
                  disabled={busy}
                  onRejoin={() => rejoin(s)}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        testID="gamePageBack"
        accessibilityRole="button"
        accessibilityLabel="Back to Library"
        onPress={() => router.back()}
        hitSlop={8}
        style={({ pressed }) => [
          styles.back,
          { top: insets.top + 6 },
          pressed && styles.backPressed,
        ]}
      >
        <View style={styles.backChevron} />
      </Pressable>

      <View style={styles.bar}>
        <LinearGradient
          colors={["rgba(18,15,34,0)", colors.dusk0]}
          style={styles.barFade}
          pointerEvents="none"
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {next && nextTitle ? (
          <>
            <Pressable
              testID={`gameSittingRejoin-${next.instanceId}`}
              accessibilityRole="button"
              accessibilityLabel={`Rejoin ${game.name}, ${nextTitle.headline}`}
              disabled={busy}
              onPress={() => rejoin(next)}
              style={({ pressed }) => [
                styles.action,
                styles.actionPrimary,
                (pressed || busy) && styles.actionPressed,
              ]}
            >
              <View style={styles.triangle} />
              <Text style={styles.actionText} numberOfLines={1}>
                Rejoin
              </Text>
            </Pressable>
            <Pressable
              testID="gameNew"
              accessibilityRole="button"
              accessibilityLabel="Start game"
              disabled={busy}
              onPress={startNew}
              hitSlop={6}
              style={({ pressed }) => [styles.textAction, pressed && styles.actionPressed]}
            >
              <Text style={styles.textActionLabel}>Start game</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            testID={needsCast ? "castToPlay" : "gameNew"}
            accessibilityRole="button"
            accessibilityLabel={needsCast ? "Cast to play" : "Start game"}
            disabled={busy}
            onPress={startNew}
            style={({ pressed }) => [
              styles.action,
              styles.actionPrimary,
              (pressed || busy) && styles.actionPressed,
            ]}
          >
            <View style={styles.triangle} />
            <Text style={styles.actionText}>
              {needsCast ? (busy ? "Casting…" : "Cast to play") : "Start game"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function SittingCard({
  sitting,
  title,
  game,
  next,
  disabled,
  onRejoin,
}: {
  sitting: Sitting;
  title: { headline: string; detail: string };
  game: Manifest;
  next: boolean;
  disabled: boolean;
  onRejoin: () => void;
}) {
  const { headline, detail } = title;
  return (
    <Pressable
      testID={`gameSitting-${sitting.instanceId}`}
      accessibilityRole="button"
      accessibilityLabel={`Rejoin ${game.name}, ${headline}, ${detail}`}
      disabled={disabled}
      onPress={onRejoin}
      style={({ pressed }) => [styles.card, next && styles.cardNext, pressed && styles.cardPressed]}
    >
      <View style={styles.cardText}>
        <Text style={styles.cardHeadline} numberOfLines={1}>
          {headline}
        </Text>
        <View style={styles.cardDetailRow}>
          {sitting.live ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.cardDetail, sitting.live && styles.cardLive]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
      {next ? (
        <Text style={styles.cardNextTag}>Up next</Text>
      ) : (
        <View
          testID={`gameSittingRejoin-${sitting.instanceId}`}
          accessibilityElementsHidden
          style={styles.rejoin}
        >
          <Text style={styles.rejoinText}>Rejoin</Text>
        </View>
      )}
    </Pressable>
  );
}

const BAR = TARGET + 12;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  ambient: { ...StyleSheet.absoluteFillObject },
  ambientArt: { width: "100%", height: "100%", opacity: 0.75 },
  scroll: { paddingBottom: 24 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  caption: { position: "absolute", left: 20, right: 20, bottom: 14, gap: 6 },
  name: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.cream },
  facts: { color: colors.cream2, fontSize: 14, fontWeight: "600", letterSpacing: 0.2 },
  body: { paddingHorizontal: 20, paddingTop: 6, gap: 6 },
  tagline: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  sittings: { gap: 10 },
  cardNext: { borderColor: colors.lamp, borderWidth: 1.5 },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  cardNextTag: {
    color: colors.lamp,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  textAction: { minHeight: TARGET, alignItems: "center", justifyContent: "center" },
  textActionLabel: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: "rgba(39, 33, 72, 0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hair,
  },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardDetailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardDetail: { color: colors.cream3, fontSize: 14, fontWeight: "600" },
  cardLive: { color: colors.ember },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember },
  cardHeadline: { color: colors.cream, fontSize: 19, fontWeight: "700" },
  rejoin: {
    minHeight: TARGET,
    paddingHorizontal: 20,
    borderRadius: TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.cream3,
  },
  rejoinText: { color: colors.cream, fontSize: 16, fontWeight: "800" },
  back: {
    position: "absolute",
    left: 14,
    width: TARGET,
    height: TARGET,
    borderRadius: TARGET / 2,
    backgroundColor: "rgba(18,15,34,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { backgroundColor: "rgba(18,15,34,0.85)" },
  backChevron: {
    width: 12,
    height: 12,
    marginLeft: 4,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.cream,
    transform: [{ rotate: "45deg" }],
  },
  flex: { flex: 1 },
  // In the layout, under the scroll, so nothing ever hides behind it; a fade marks the edge.
  bar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    backgroundColor: colors.dusk0,
  },
  barFade: { position: "absolute", left: 0, right: 0, top: -28, height: 28 },
  note: { color: colors.peach, fontSize: 15, textAlign: "center" },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: BAR,
    borderRadius: BAR / 2,
  },
  actionPrimary: { backgroundColor: colors.lamp },
  actionPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: colors.ink,
  },
  actionText: { color: colors.ink, fontSize: 19, fontWeight: "800" },
});
