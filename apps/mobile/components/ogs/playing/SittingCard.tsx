import type { Manifest } from "@open-game-system/ogs-protocol";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { SittingRow } from "../../../services/playing-home";
import type { Sitting } from "../../../services/sittings";
import { artUrl, GameArt } from "../GameArt";
import { artKit } from "../library/art-kit";
import { usePlay } from "../library/use-play";
import { colors, TARGET } from "../theme";

/**
 * One more sitting: the game's icon, its name as a small eyebrow, the resume point (or when it
 * started) as the headline, when it was last played, where Rejoin lands, and Rejoin.
 */
export function SittingCard({
  row,
  game,
  sitting,
  testID,
}: {
  row: SittingRow;
  game: Manifest;
  sitting: Sitting;
  testID: string;
}) {
  const play = usePlay(game);
  const icon = artKit(game).icon;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[row.name, row.headline, row.meta, row.where, "Rejoin"]
        .filter(Boolean)
        .join(", ")}
      disabled={play.busy}
      onPress={() => play.rejoin(sitting)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {icon ? (
        <Image source={{ uri: artUrl(icon) }} style={styles.art} />
      ) : (
        <GameArt game={game} style={styles.art} />
      )}
      <View style={styles.text}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.headline} numberOfLines={1}>
          {row.headline}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {play.note ?? row.meta}
        </Text>
        <Text style={styles.where} numberOfLines={1}>
          {row.where}
        </Text>
      </View>
      <View style={styles.rejoin}>
        <Text style={styles.rejoinText}>{play.busy ? "Casting…" : "Rejoin"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 10,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: colors.dusk1,
    marginBottom: 10,
  },
  pressed: { backgroundColor: colors.dusk2 },
  art: { width: 84, height: 84, borderRadius: 14, backgroundColor: colors.dusk2 },
  text: { flex: 1, gap: 1 },
  eyebrow: {
    color: colors.lamp,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headline: { color: colors.cream, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.cream3, fontSize: 14 },
  where: { color: colors.lilac, fontSize: 13, fontWeight: "700", marginTop: 1 },
  rejoin: {
    minHeight: TARGET,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.peach,
    alignItems: "center",
    justifyContent: "center",
  },
  rejoinText: { color: colors.peach, fontSize: 15, fontWeight: "800" },
});
