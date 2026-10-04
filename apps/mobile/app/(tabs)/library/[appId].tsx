import type { Manifest } from "@open-game-system/ogs-protocol";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { artUrl, GameArt } from "../../../components/ogs/GameArt";
import { artKit } from "../../../components/ogs/library/art-kit";
import { gameFacts } from "../../../components/ogs/library/game-facts";
import { sittingTitle } from "../../../components/ogs/library/sitting-title";
import { usePlay } from "../../../components/ogs/library/use-play";
import { SectionTitle } from "../../../components/ogs/Screen";
import { colors, fonts, TARGET } from "../../../components/ogs/theme";
import { useApp, useCouch } from "../../../services/runtime";
import { type Sitting, sittingsFor } from "../../../services/sittings";

/**
 * A game's page, in the Library tab's stack (the tab bar stays): the art with the name set on it,
 * your in-progress sittings of it as cards (each with its own Rejoin: two games of Catan are two
 * cards), and Start game pinned at the bottom in thumb reach. Spec v3, tv: required and not cast:
 * the pinned action is Cast to play instead, and a Rejoin casts first.
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
  const now = Date.now();
  const sittings = sittingsFor(game, app.instances, state, now);
  const kit = artKit(game);
  const facts = gameFacts(game.shop);
  const primaryIsNew = sittings.length === 0 || needsCast;

  return (
    <View style={styles.root} testID="gamePage">
      <StatusBar style="light" />
      <View style={styles.ambient} pointerEvents="none">
        <Image source={{ uri: artUrl(kit.hero) }} style={styles.ambientArt} blurRadius={50} />
        <LinearGradient
          colors={["rgba(18,15,34,0.2)", colors.dusk0]}
          locations={[0.1, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <GameArt game={game} hero style={styles.art} />
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
            {kit.logo ? (
              <Image source={{ uri: artUrl(kit.logo) }} style={styles.logo} resizeMode="contain" />
            ) : (
              <Text style={styles.name} accessibilityRole="header">
                {game.name}
              </Text>
            )}
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
                  game={game}
                  now={now}
                  primary={i === 0 && !needsCast}
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
          locations={[0, 0.45]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Pressable
          testID={needsCast ? "castToPlay" : "gameNew"}
          accessibilityRole="button"
          accessibilityLabel={needsCast ? "Cast to play" : "Start game"}
          disabled={busy}
          onPress={startNew}
          style={({ pressed }) => [
            styles.action,
            primaryIsNew ? styles.actionPrimary : styles.actionQuiet,
            (pressed || busy) && styles.actionPressed,
          ]}
        >
          {primaryIsNew ? <View style={styles.triangle} /> : null}
          <Text style={[styles.actionText, !primaryIsNew && styles.actionTextQuiet]}>
            {needsCast ? (busy ? "Casting…" : "Cast to play") : "Start game"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SittingCard({
  sitting,
  game,
  now,
  primary,
  disabled,
  onRejoin,
}: {
  sitting: Sitting;
  game: Manifest;
  now: number;
  primary: boolean;
  disabled: boolean;
  onRejoin: () => void;
}) {
  const { headline, detail } = sittingTitle(sitting, game.appId, now);
  return (
    <View style={styles.card} testID={`gameSitting-${sitting.instanceId}`}>
      <View style={styles.cardText}>
        <View style={styles.cardDetailRow}>
          {sitting.live ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.cardDetail, sitting.live && styles.cardLive]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Text style={styles.cardHeadline} numberOfLines={1}>
          {headline}
        </Text>
      </View>
      <Pressable
        testID={`gameSittingRejoin-${sitting.instanceId}`}
        accessibilityRole="button"
        accessibilityLabel={`Rejoin ${game.name}, ${headline}, ${detail}`}
        disabled={disabled}
        onPress={onRejoin}
        style={({ pressed }) => [
          styles.rejoin,
          primary ? styles.rejoinPrimary : styles.rejoinQuiet,
          (pressed || disabled) && styles.actionPressed,
        ]}
      >
        <Text style={[styles.rejoinText, !primary && styles.rejoinTextQuiet]}>Rejoin</Text>
      </Pressable>
    </View>
  );
}

const BAR = TARGET + 12;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  ambient: { ...StyleSheet.absoluteFillObject, bottom: "35%" },
  ambientArt: { width: "100%", height: "100%", opacity: 0.6 },
  scroll: { paddingBottom: BAR + 40 },
  art: { width: "100%", aspectRatio: 4 / 3, borderRadius: 0 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  caption: { position: "absolute", left: 20, right: 20, bottom: 14, gap: 6 },
  name: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.cream },
  logo: { width: "70%", height: 80 },
  facts: { color: colors.cream2, fontSize: 14, fontWeight: "600", letterSpacing: 0.2 },
  body: { paddingHorizontal: 20, paddingTop: 6, gap: 6 },
  tagline: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  sittings: { gap: 10 },
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
  },
  rejoinPrimary: { backgroundColor: colors.lamp },
  rejoinQuiet: { borderWidth: 1.5, borderColor: colors.cream3 },
  rejoinText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  rejoinTextQuiet: { color: colors.cream },
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
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 12,
    gap: 8,
  },
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
  actionQuiet: { borderWidth: 1.5, borderColor: colors.cream3, backgroundColor: colors.dusk1 },
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
  actionTextQuiet: { color: colors.cream },
});
