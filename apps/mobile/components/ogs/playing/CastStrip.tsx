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
      accessibilityLabel={cast ? `On ${tvName}. Open the remote` : "Not casting. Cast to TV"}
      onPress={onTv}
      style={({ pressed }) => [styles.strip, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.glyph} accessibilityElementsHidden>
        <View style={[styles.screen, cast && styles.screenOn]}>
          {cast ? <View style={styles.dot} /> : null}
        </View>
        <View style={[styles.stand, cast && styles.standOn]} />
      </View>
      <Text style={styles.text} numberOfLines={2}>
        {cast ? `On ${tvName}` : "Not casting"}
      </Text>
      <Text style={[styles.link, !cast && styles.linkQuiet]}>{cast ? "Remote" : "Cast to TV"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: TARGET,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    marginBottom: 16,
  },
  glyph: { width: 20, alignItems: "center" },
  screen: {
    width: 20,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.cream3,
    alignItems: "center",
    justifyContent: "center",
  },
  screenOn: { borderColor: colors.ember },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ember },
  stand: { width: 8, height: 1.5, marginTop: 2, backgroundColor: colors.cream3 },
  standOn: { backgroundColor: colors.ember },
  text: { flex: 1, color: colors.cream, fontSize: 16, fontWeight: "700" },
  link: { color: colors.lamp, fontSize: 15, fontWeight: "800" },
  // Not cast, Cast to TV is a quiet way out; the card below holds the one primary action.
  linkQuiet: { color: colors.cream2 },
});
