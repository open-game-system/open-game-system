import type { Manifest } from "@open-game-system/ogs-protocol";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { artUrl, GameArt } from "../GameArt";
import { colors, fonts } from "../theme";
import { artKit } from "./art-kit";

/**
 * One game on a Library shelf: big art with its name set on it, nothing else. `cover` shows the 2:3
 * cover (logo baked in, so no name); `landscape` is today's 16:9 art with the HUD-safe crop.
 * A press sinks the art and rings it in lamp light.
 */
export function GameCapsule({
  game,
  shape,
  width,
  onPress,
  testID,
}: {
  game: Manifest;
  shape: "cover" | "landscape";
  width: number;
  onPress: () => void;
  testID?: string;
}) {
  const cover = shape === "cover" ? artKit(game).cover : null;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={game.name}
      onPress={onPress}
      style={{ width }}
    >
      {({ pressed }) => (
        <View style={pressed ? styles.pressed : undefined}>
          <View style={[styles.frame, pressed && styles.ring]}>
            {cover ? (
              <View style={[styles.art, styles.cover]}>
                <Image source={{ uri: artUrl(cover) }} style={styles.fill} />
              </View>
            ) : (
              <View>
                <GameArt game={game} style={styles.art} />
                <LinearGradient
                  colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.88)"]}
                  locations={[0.35, 1]}
                  style={styles.scrim}
                  pointerEvents="none"
                />
                <Text
                  style={styles.name}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {game.name}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },
  frame: { borderRadius: 17, borderWidth: 3, borderColor: "transparent", margin: -3 },
  ring: { borderColor: colors.lamp },
  art: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14 },
  cover: { aspectRatio: 2 / 3, overflow: "hidden", backgroundColor: colors.dusk2 },
  fill: { width: "100%", height: "100%" },
  scrim: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  name: {
    position: "absolute",
    left: 12,
    right: 10,
    bottom: 9,
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.cream,
  },
});
