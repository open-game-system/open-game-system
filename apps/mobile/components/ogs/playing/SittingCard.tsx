import type { Manifest } from "@open-game-system/ogs-protocol";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
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
  showWhere = true,
  live,
  testID,
}: {
  row: SittingRow;
  game: Manifest;
  sitting: Sitting;
  /** False when the group says where once, above its cards. */
  showWhere?: boolean;
  /** The game live on the TV and the TV's name, for Switch TV's question. */
  live: { name: string; tvName: string } | null;
  testID: string;
}) {
  const play = usePlay(game);
  const rejoin = () => play.rejoin(sitting);
  // Taking the TV from the live game pauses it for everyone, so it asks first.
  const onPress = () =>
    row.action === "Switch TV" && live
      ? Alert.alert(
          `Switch the TV to ${row.name}?`,
          `${live.name} pauses for everyone on ${live.tvName}. It stays in progress, so anyone can Rejoin it.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Switch TV", onPress: rejoin },
          ],
        )
      : rejoin();
  const icon = artKit(game).icon;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[row.name, row.headline, row.meta, row.where, row.action]
        .filter(Boolean)
        .join(", ")}
      disabled={play.busy}
      onPress={onPress}
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
        <Text style={styles.headline} numberOfLines={2}>
          {row.headline}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {play.note ?? row.meta}
        </Text>
        {showWhere ? (
          <Text style={styles.where} numberOfLines={2}>
            {row.where}
          </Text>
        ) : null}
      </View>
      <View style={styles.rejoin}>
        <Text style={styles.rejoinText}>{play.busy ? "Casting…" : row.action}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Flat rows on the dusk page, split by hairlines: a list, not a stack of cards.
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hair,
  },
  pressed: { opacity: 0.7 },
  art: { width: 76, height: 76, borderRadius: 16, backgroundColor: colors.dusk2 },
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
