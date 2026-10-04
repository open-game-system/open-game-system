import type { Manifest } from "@open-game-system/ogs-protocol";
import { Image, StyleSheet, Text, type TextStyle, View } from "react-native";
import { artUrl, GameArt } from "../GameArt";
import { colors, fonts } from "../theme";
import { artKit } from "./art-kit";

/**
 * A game's key art filling a `width` × `height` frame: the clean hero (no HUD, no text) anchored
 * to its right, where the subject sits, so a taller frame trims the empty logo third first. Without
 * a clean hero, the capture with its HUD-safe crop.
 */
export function KeyArt({
  game,
  width,
  height,
  radius = 0,
}: {
  game: Manifest;
  width: number;
  height: number;
  radius?: number;
}) {
  const clean = artKit(game).heroClean;
  if (!clean) return <GameArt game={game} hero style={{ width, height, borderRadius: radius }} />;
  const artWidth = Math.max(width, (height * 16) / 9);
  return (
    <View style={[styles.frame, { width, height, borderRadius: radius }]}>
      <Image
        source={{ uri: artUrl(clean) }}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: artWidth,
          height: artWidth * (9 / 16),
        }}
      />
    </View>
  );
}

/** The game's logo (transparent wordmark), else its name set in the display face. */
export function GameLogo({
  game,
  width,
  height,
  nameStyle,
}: {
  game: Manifest;
  width: number;
  height: number;
  nameStyle?: TextStyle;
}) {
  const logo = artKit(game).logo;
  if (logo)
    return (
      <Image
        source={{ uri: artUrl(logo) }}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel={game.name}
      />
    );
  return (
    <Text style={[styles.name, nameStyle]} numberOfLines={2} accessibilityRole="header">
      {game.name}
    </Text>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.dusk2 },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.cream },
});
