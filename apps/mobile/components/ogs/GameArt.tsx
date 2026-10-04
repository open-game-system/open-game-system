import type { Manifest } from "@open-game-system/ogs-protocol";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { safeCrop } from "../../services/art-crop";
import { config } from "../../services/runtime";
import { colors } from "./theme";

/** Manifest art may be absolute or relative to the OGS launcher (which serves /art). */
export function artUrl(path: string): string {
  return /^https?:\/\//.test(path)
    ? path
    : `${config.tvBase}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function GameArt({
  game,
  style,
  hero = false,
}: {
  game: Manifest;
  style?: ViewStyle;
  hero?: boolean;
}) {
  return (
    <View style={[styles.frame, style]}>
      <Image
        source={{ uri: artUrl((hero && game.art.hero) || game.art.tile) }}
        style={[styles.img, safeCrop(game.art.safe)]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", borderRadius: 14, backgroundColor: colors.dusk2 },
  img: { width: "100%", height: "100%" },
});
