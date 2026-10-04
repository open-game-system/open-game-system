import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, TARGET } from "../theme";

/**
 * The TV at a glance, on top of Playing: cast (which TV, and its remote) or not cast (Cast to TV).
 * Both open the TV tab, which owns casting and Stop casting.
 */
export function CastStrip({ tvName, onTv }: { tvName: string | null; onTv: () => void }) {
  const cast = tvName !== null;
  return (
    <Pressable
      testID="playingCastStrip"
      accessibilityRole="button"
      accessibilityLabel={cast ? `On ${tvName}. Open the remote` : "TV not cast. Cast to TV"}
      onPress={onTv}
      style={({ pressed }) => [styles.strip, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.dot, !cast && styles.dotOff]} />
      <Text style={styles.text} numberOfLines={1}>
        {cast ? `On ${tvName}` : "TV not cast"}
      </Text>
      <Text style={styles.link}>{cast ? "Remote" : "Cast to TV"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: TARGET,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    marginBottom: 16,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ember },
  dotOff: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.cream3 },
  text: { flex: 1, color: colors.cream, fontSize: 16, fontWeight: "700" },
  link: { color: colors.lamp, fontSize: 15, fontWeight: "800" },
});
