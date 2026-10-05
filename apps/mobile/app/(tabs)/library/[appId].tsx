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
 * games of Catan are two cards; the newest one's Rejoin is the page's primary). The footer, in
 * thumb reach, is Play when there's nothing to rejoin, else Start game as the secondary. Owner,
 * 2026-10-04: Play (and Rejoin) ask to cast first when the game needs the TV (usePlay).
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
  const { rejoin, startNew } = usePlay(game);
  const { width, height } = useWindowDimensions();
  const now = Date.now();
  const sittings = sittingsFor(game, app.instances, state, now);
  const titles = sittingTitles(sittings, game.appId, now);
  const facts = gameFacts(game.shop);
  // The art is the page (as on the Library hero): it runs from under the status bar and fades
  // into the page colour, and the logo, facts, tagline and sittings stack up from the bottom over
  // its fade, so the page never has an empty band. The art always shows at least `reveal`.
  const artHeight = Math.round(height * 0.72);
  const reveal = insets.top + Math.round(height * (sittings.length > 0 ? 0.16 : 0.3));
  // One filled action per page: the newest sitting's Rejoin, else the footer's Play.
  const footerPrimary = sittings.length === 0;

  return (
    <View style={styles.root} testID="gamePage">
      <StatusBar style="light" />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.art, { height: artHeight }]} pointerEvents="none">
          <KeyArt game={game} width={width} height={artHeight} />
          <LinearGradient
            colors={["rgba(18,15,34,0.7)", "rgba(18,15,34,0)"]}
            style={[styles.topScrim, { height: insets.top + 64 }]}
          />
          <LinearGradient
            colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.78)", colors.dusk0]}
            locations={[0, 0.6, 1]}
            style={styles.bottomScrim}
          />
        </View>
        <View style={[styles.body, { paddingTop: reveal }]}>
          <View style={styles.caption}>
            <GameLogo
              game={game}
              width={Math.round(width * 0.56)}
              height={Math.round(width * 0.26)}
              nameStyle={styles.name}
            />
            {facts.length > 0 ? (
              <Text style={styles.facts} numberOfLines={1}>
                {facts.join("  ·  ")}
              </Text>
            ) : null}
          </View>
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
                  primary={i === 0}
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
        <Pressable
          testID={footerPrimary ? "gamePlay" : "gameNew"}
          accessibilityRole="button"
          accessibilityLabel={footerPrimary ? `Play ${game.name}` : "Start game"}
          onPress={startNew}
          style={({ pressed }) => [
            styles.action,
            footerPrimary ? styles.actionPrimary : styles.actionQuiet,
            pressed && styles.pressed,
          ]}
        >
          {footerPrimary ? <View style={styles.triangle} /> : null}
          <Text style={[styles.actionText, !footerPrimary && styles.actionTextQuiet]}>
            {footerPrimary ? "Play" : "Start game"}
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
  onRejoin,
}: {
  sitting: Sitting;
  title: { headline: string; detail: string };
  game: Manifest;
  primary: boolean;
  onRejoin: () => void;
}) {
  const { headline, detail } = title;
  const icon = artKit(game).icon;
  return (
    <View style={styles.card} testID={`gameSitting-${sitting.instanceId}`}>
      {icon ? <Image source={{ uri: artUrl(icon) }} style={styles.icon} /> : null}
      <View style={styles.cardText}>
        <Text
          style={styles.cardHeadline}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
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
        onPress={onRejoin}
        style={({ pressed }) => [
          styles.rejoin,
          primary ? styles.rejoinPrimary : styles.rejoinQuiet,
          pressed && styles.pressed,
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
  // Short content sits at the bottom, over the art's fade; long content scrolls.
  scroll: { flexGrow: 1, paddingBottom: 12 },
  art: { position: "absolute", top: 0, left: 0, right: 0 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" },
  caption: { gap: 8, alignItems: "flex-start" },
  name: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.cream },
  facts: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowRadius: 6,
  },
  body: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 20, gap: 10 },
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
    paddingHorizontal: 16,
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
    backgroundColor: "rgba(18,15,34,0.78)",
    borderWidth: 1,
    borderColor: "rgba(251,242,228,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { backgroundColor: "rgba(18,15,34,0.95)" },
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
