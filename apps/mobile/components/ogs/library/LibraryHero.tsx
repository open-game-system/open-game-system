import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { artUrl, GameArt } from "../GameArt";
import { colors, fonts, TARGET } from "../theme";
import { artKit } from "./art-kit";
import { type LibraryHero as Hero, heroEyebrow } from "./shelves";
import { usePlay } from "./use-play";

/**
 * The Library's big game (Steam's "continue playing"): the art, its name set large on it, and one
 * action: Rejoin its newest sitting, else Start game. A tap on the art opens the game's page.
 * The art, blurred, tints the top of the page.
 */
export function LibraryHero({
  hero,
  onOpen,
  testID,
}: {
  hero: Hero;
  onOpen: () => void;
  testID?: string;
}) {
  const { game, sitting } = hero;
  const play = usePlay(game);
  const kit = artKit(game);
  const eyebrow = heroEyebrow(hero, Date.now());
  const label = play.busy ? "Casting…" : sitting ? "Rejoin" : "Start game";
  return (
    <View style={styles.root}>
      <View style={styles.ambient} pointerEvents="none">
        <Image source={{ uri: artUrl(kit.hero) }} style={styles.fill} blurRadius={40} />
        <LinearGradient
          colors={["rgba(18,15,34,0.35)", colors.dusk0]}
          locations={[0, 0.95]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${game.name}, open its page`}
        onPress={onOpen}
      >
        {({ pressed }) => (
          <View style={[styles.card, pressed && styles.pressed]}>
            <GameArt game={game} hero style={styles.art} />
            <LinearGradient
              colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.85)"]}
              locations={[0.4, 1]}
              style={styles.scrim}
              pointerEvents="none"
            />
            <View style={styles.caption} pointerEvents="none">
              {eyebrow ? (
                <Text style={styles.eyebrow} numberOfLines={1}>
                  {eyebrow}
                </Text>
              ) : null}
              {kit.logo ? (
                <Image
                  source={{ uri: artUrl(kit.logo) }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.name} numberOfLines={2}>
                  {game.name}
                </Text>
              )}
            </View>
          </View>
        )}
      </Pressable>
      <Pressable
        testID="libraryHeroPlay"
        accessibilityRole="button"
        accessibilityLabel={`${sitting ? "Rejoin" : "Start game"} ${game.name}`}
        disabled={play.busy}
        onPress={() => (sitting ? play.rejoin(sitting) : play.startNew())}
        style={({ pressed }) => [styles.play, (pressed || play.busy) && styles.playPressed]}
      >
        <View style={styles.triangle} />
        <Text style={styles.playText}>{label}</Text>
      </Pressable>
      {play.note ? <Text style={styles.note}>{play.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, marginBottom: 6 },
  ambient: { position: "absolute", top: -160, left: -20, right: -20, bottom: -40 },
  fill: { width: "100%", height: "100%", opacity: 0.55 },
  card: { borderRadius: 22, overflow: "hidden" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  art: { width: "100%", aspectRatio: 16 / 10, borderRadius: 22 },
  scrim: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
  caption: { position: "absolute", left: 18, right: 18, bottom: 16, gap: 2 },
  eyebrow: {
    color: colors.lamp,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.cream },
  logo: { width: "60%", height: 64, alignSelf: "flex-start" },
  play: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: TARGET + 12,
    borderRadius: (TARGET + 12) / 2,
    backgroundColor: colors.lamp,
  },
  playPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
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
  playText: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  note: { color: colors.peach, fontSize: 15 },
});
