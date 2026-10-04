import type { Manifest } from "@open-game-system/ogs-protocol";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { artUrl, GameArt } from "../GameArt";
import { colors } from "../theme";
import { artKit } from "./art-kit";

/**
 * One game on a Library shelf: big art, the name under it, nothing else. `cover` shows the 2:3
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
              <GameArt game={game} style={styles.art} />
            )}
          </View>
          {cover ? null : (
            <Text style={styles.name} numberOfLines={1}>
              {game.name}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.96 }] },
  frame: { borderRadius: 16, borderWidth: 2, borderColor: "transparent", margin: -2 },
  ring: { borderColor: colors.lamp },
  art: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14 },
  cover: { aspectRatio: 2 / 3, overflow: "hidden", backgroundColor: colors.dusk2 },
  fill: { width: "100%", height: "100%" },
  name: { marginTop: 8, color: colors.cream, fontSize: 16, fontWeight: "700" },
});
