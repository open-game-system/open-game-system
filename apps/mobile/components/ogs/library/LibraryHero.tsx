import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, TARGET } from "../theme";
import { GameLogo, KeyArt } from "./KeyArt";
import { playVerb } from "./play-action";
import { type LibraryHero as Hero, heroAction, heroEyebrow } from "./shelves";
import { usePlay } from "./use-play";

/**
 * The Library's big game (Steam's "continue playing"), full bleed: its key art edge to edge and up
 * under the status bar, the page's title over the art's top left on a scrim, and over a soft bottom
 * gradient the logo in the left third with one action under it: Rejoin its newest sitting, else
 * Play (either asks to cast first when the game needs the TV: usePlay). A tap on the art opens
 * the game's page.
 */
export function LibraryHero({
  hero,
  title,
  width,
  topInset,
  onOpen,
  testID,
}: {
  hero: Hero;
  /** The page's title, set over the art's top left. */
  title: string;
  width: number;
  /** The safe-area top inset: the art runs under it, the title sits below it. */
  topInset: number;
  onOpen: () => void;
  testID?: string;
}) {
  const { game, sitting } = hero;
  const play = usePlay(game);
  const eyebrow = heroEyebrow(hero);
  const action = heroAction(hero);
  const verb = playVerb(action === "rejoin");
  // Tall enough for the art to lead, short enough that All Games starts above the fold.
  const height = topInset + Math.round(width * 0.8);
  return (
    <View style={{ width, height }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${game.name}, open its page`}
        onPress={onOpen}
      >
        {({ pressed }) => (
          <View style={pressed && styles.pressed}>
            <KeyArt game={game} width={width} height={height} />
          </View>
        )}
      </Pressable>
      <LinearGradient
        colors={["rgba(18,15,34,0.72)", "rgba(18,15,34,0)"]}
        style={[styles.topScrim, { height: topInset + 140 }]}
        pointerEvents="none"
      />
      {/* Blends into the page below, so All Games reads as the same surface. */}
      <LinearGradient
        colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.7)", colors.dusk0]}
        locations={[0, 0.55, 1]}
        style={styles.bottomScrim}
        pointerEvents="none"
      />
      <Text
        style={[styles.title, { top: topInset + 12 }]}
        accessibilityRole="header"
        pointerEvents="none"
      >
        {title}
      </Text>
      <View style={styles.foot} pointerEvents="box-none">
        <View pointerEvents="none" style={styles.caption}>
          <GameLogo
            game={game}
            width={Math.round(width * 0.42)}
            height={Math.round(width * 0.22)}
          />
          {eyebrow ? (
            <View style={styles.eyebrowRow}>
              {sitting?.live ? <View style={styles.liveDot} /> : null}
              <Text style={styles.eyebrow} numberOfLines={1}>
                {eyebrow}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          testID="libraryHeroPlay"
          accessibilityRole="button"
          accessibilityLabel={`${verb} ${game.name}`}
          onPress={() => (action === "rejoin" && sitting ? play.rejoin(sitting) : play.startNew())}
          style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
        >
          <View style={styles.triangle} />
          <Text style={styles.playText}>{verb}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const BAR = TARGET + 12;

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "58%" },
  title: {
    position: "absolute",
    left: 20,
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.cream,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowRadius: 8,
  },
  foot: { position: "absolute", left: 20, right: 20, bottom: 14, gap: 22 },
  caption: { gap: 8, alignItems: "flex-start" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ember },
  eyebrow: {
    color: colors.lamp,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  play: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minWidth: 168,
    minHeight: BAR,
    paddingHorizontal: 28,
    borderRadius: BAR / 2,
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
});
