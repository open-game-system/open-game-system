import type { Manifest } from "@open-game-system/ogs-protocol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GameArt } from "../GameArt";
import { colors, fonts } from "../theme";
import type { RowAffordance } from "./row-affordance";

/** One Library game, full width: art on the left, name and status, Rejoin or a chevron on the right. */
export function LibraryRow({
  game,
  status,
  affordance,
  needsTv,
  onPress,
  testID,
}: {
  game: Manifest;
  status: string;
  affordance: RowAffordance;
  needsTv: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const rejoin = affordance === "rejoin";
  const isNew = status === "New";
  // A game in progress already has its TV (or its own way back in): the badge is for choosing.
  const tvBadge = needsTv && !rejoin;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${game.name}, ${status}${needsTv ? ", needs a TV" : ""}${rejoin ? ", Rejoin" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <GameArt game={game} style={styles.art} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {game.name}
        </Text>
        <View style={styles.meta}>
          {isNew ? <View style={styles.newDot} /> : null}
          <Text
            style={[styles.status, isNew && styles.statusNew, rejoin && styles.statusLive]}
            numberOfLines={1}
          >
            {status}
          </Text>
          {tvBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                Needs a TV
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {rejoin ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>Rejoin</Text>
        </View>
      ) : (
        <View style={styles.chevron} />
      )}
    </Pressable>
  );
}

export const ROW_ART_WIDTH = 112;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 84,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.dusk1,
  },
  pressed: { backgroundColor: colors.dusk2 },
  art: { width: ROW_ART_WIDTH, aspectRatio: 16 / 9, borderRadius: 12 },
  text: { flex: 1, minWidth: 0, gap: 6 },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.cream },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lilac },
  status: { flexShrink: 1, color: colors.cream3, fontSize: 14, fontWeight: "600" },
  statusNew: { color: colors.lilac },
  statusLive: { color: colors.cream2 },
  badge: {
    marginLeft: 4,
    flexShrink: 0,
    backgroundColor: colors.dusk3,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { color: colors.cream2, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  pill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.lamp,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  chevron: {
    width: 10,
    height: 10,
    marginRight: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.cream3,
    transform: [{ rotate: "45deg" }],
  },
});
