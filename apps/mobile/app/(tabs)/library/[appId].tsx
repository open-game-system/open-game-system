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
import { colors, fonts, TARGET } from "../../../components/ogs/theme";
import { useApp, useCouch } from "../../../services/runtime";
import { type Sitting, sittingsFor } from "../../../services/sittings";

/**
 * A game's page, in the Library tab's stack (the tab bar stays): its key art with the logo, the
 * page tinted by the art, and your in-progress sittings as cards, each with its own Rejoin (two
 * games of Catan are two cards; the newest one's Rejoin is the page's primary). Start game sits in
 * a footer in thumb reach: the primary when there's nothing to rejoin, else secondary. Spec v3,
 * tv: required and not cast: the footer is Cast to play, and a Rejoin casts first.
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
  const kit = artKit(game);
  const facts = gameFacts(game.shop);
  // The art fills the page when there's nothing to list; sittings get the room when there are.
  const artHeight = Math.round(height * (sittings.length > 0 ? (height < 850 ? 0.32 : 0.4) : 0.54));
  // One filled action per page: the newest sitting's Rejoin, else the footer.
  const footerPrimary = sittings.length === 0 || needsCast;

  return (
    <View style={styles.root} testID="gamePage">
      <StatusBar style="light" />
      <Image
        source={{ uri: artUrl(kit.heroClean ?? kit.hero) }}
        style={styles.tint}
        blurRadius={60}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View>
          <KeyArt game={game} width={width} height={artHeight} />
          <LinearGradient
            colors={["rgba(18,15,34,0.7)", "rgba(18,15,34,0)"]}
            style={[styles.topScrim, { height: insets.top + 56 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.82)"]}
            locations={[0.25, 1]}
            style={styles.bottomScrim}
            pointerEvents="none"
          />
          <View style={styles.caption}>
            <GameLogo
              game={game}
              width={width * 0.56}
              height={Math.min(artHeight * 0.34, 120)}
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
              <Text style={styles.heading} accessibilityRole="header">
                In progress
              </Text>
              {sittings.map((s, i) => (
                <SittingCard
                  key={s.instanceId}
                  sitting={s}
                  title={titles[i]}
                  game={game}
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

      <View style={styles.footer}>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Pressable
          testID={needsCast ? "castToPlay" : "gameNew"}
          accessibilityRole="button"
          accessibilityLabel={needsCast ? "Cast to play" : "Start game"}
          disabled={busy}
          onPress={startNew}
          style={({ pressed }) => [
            styles.action,
            footerPrimary ? styles.actionPrimary : styles.actionQuiet,
            (pressed || busy) && styles.pressed,
          ]}
        >
          {footerPrimary ? <View style={styles.triangle} /> : null}
          <Text style={[styles.actionText, !footerPrimary && styles.actionTextQuiet]}>
            {needsCast ? (busy ? "Casting…" : "Cast to play") : "Start game"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SittingCard({
  sitting,
  title,
  game,
  primary,
  disabled,
  onRejoin,
}: {
  sitting: Sitting;
  title: { headline: string; detail: string };
  game: Manifest;
  primary: boolean;
  disabled: boolean;
  onRejoin: () => void;
}) {
  const { headline, detail } = title;
  const icon = artKit(game).icon;
  return (
    <View style={styles.card} testID={`gameSitting-${sitting.instanceId}`}>
      {icon ? <Image source={{ uri: artUrl(icon) }} style={styles.icon} /> : null}
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
      <Pressable
        testID={`gameSittingRejoin-${sitting.instanceId}`}
        accessibilityRole="button"
        accessibilityLabel={`Rejoin ${game.name}, ${headline}, ${detail}`}
        disabled={disabled}
        onPress={onRejoin}
        style={({ pressed }) => [
          styles.rejoin,
          primary ? styles.rejoinPrimary : styles.rejoinQuiet,
          (pressed || disabled) && styles.pressed,
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
  flex: { flex: 1 },
  // The page takes the game's colours: its art, blurred far past recognition, under everything.
  tint: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.32 },
  scroll: { paddingBottom: 20 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  caption: { position: "absolute", left: 20, right: 20, bottom: 14, gap: 8 },
  name: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.cream },
  facts: { color: colors.cream, fontSize: 14, fontWeight: "600", letterSpacing: 0.2 },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  tagline: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  heading: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.cream,
    marginTop: 14,
    marginBottom: 4,
  },
  sittings: { gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(18,15,34,0.62)",
  },
  icon: { width: 52, height: 52, borderRadius: 14 },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardHeadline: { color: colors.cream, fontSize: 18, fontWeight: "700" },
  cardDetailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardDetail: { color: colors.cream3, fontSize: 14, fontWeight: "600" },
  cardLive: { color: colors.ember },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember },
  rejoin: {
    minHeight: TARGET,
    paddingHorizontal: 18,
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
  // In the layout, under the scroll, so nothing ever hides behind it.
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 6 },
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
  actionQuiet: { borderWidth: 1.5, borderColor: colors.cream3 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
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
