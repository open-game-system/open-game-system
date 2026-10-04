import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, TARGET } from "../theme";
import { artKit } from "./art-kit";
import { GameLogo, KeyArt } from "./KeyArt";
import { type LibraryHero as Hero, heroEyebrow } from "./shelves";
import { usePlay } from "./use-play";

/**
 * The Library's big game (Steam's "continue playing"): its clean key art with the logo in the
 * left third, and one action: Rejoin its newest sitting, else Start game. A tap on the art opens
 * the game's page.
 */
export function LibraryHero({
  hero,
  action,
  width,
  onOpen,
  testID,
}: {
  hero: Hero;
  /** Its one button (see heroAction); null when the return pill already rejoins it. */
  action: "rejoin" | "start" | null;
  width: number;
  onOpen: () => void;
  testID?: string;
}) {
  const { game, sitting } = hero;
  const play = usePlay(game);
  const kit = artKit(game);
  const eyebrow = heroEyebrow(hero);
  const verb = action === "rejoin" ? "Rejoin" : "Start game";
  const label = play.busy ? "Casting…" : verb;
  const height = Math.round((width * 9) / 16);
  // The clean hero leaves its left third for the logo; a capture gets a scrim and the logo low.
  const clean = kit.heroClean !== null;
  return (
    <View style={styles.root}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${game.name}, open its page`}
        onPress={onOpen}
      >
        {({ pressed }) => (
          <View style={[styles.card, pressed && styles.pressed]}>
            <KeyArt game={game} width={width} height={height} radius={22} />
            {clean ? (
              <LinearGradient
                colors={["rgba(18,15,34,0.45)", "rgba(18,15,34,0)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.55, y: 0.5 }}
                style={styles.scrim}
                pointerEvents="none"
              />
            ) : (
              <LinearGradient
                colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.85)"]}
                locations={[0.4, 1]}
                style={styles.scrim}
                pointerEvents="none"
              />
            )}
            <View
              style={[styles.caption, clean ? styles.captionClean : styles.captionLow]}
              pointerEvents="none"
            >
              <GameLogo
                game={game}
                width={clean ? width * 0.42 : width * 0.55}
                height={clean ? height * 0.62 : height * 0.36}
              />
            </View>
            {eyebrow ? (
              <View style={styles.eyebrowPill} pointerEvents="none">
                {hero.sitting?.live ? <View style={styles.liveDot} /> : null}
                <Text style={styles.eyebrow} numberOfLines={1}>
                  {eyebrow}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      {action ? (
        <Pressable
          testID="libraryHeroPlay"
          accessibilityRole="button"
          accessibilityLabel={`${verb} ${game.name}`}
          disabled={play.busy}
          onPress={() => (action === "rejoin" && sitting ? play.rejoin(sitting) : play.startNew())}
          style={({ pressed }) => [styles.play, (pressed || play.busy) && styles.playPressed]}
        >
          <View style={styles.triangle} />
          <Text style={styles.playText}>{label}</Text>
        </Pressable>
      ) : null}
      {play.note ? <Text style={styles.note}>{play.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, marginBottom: 6 },
  card: { borderRadius: 22, overflow: "hidden" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  scrim: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
  caption: { position: "absolute", left: 14 },
  captionClean: { top: 0, bottom: 0, justifyContent: "center" },
  captionLow: { bottom: 12 },
  eyebrowPill: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(18,15,34,0.72)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ember },
  eyebrow: {
    color: colors.lamp,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
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
