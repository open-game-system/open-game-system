import type { Manifest } from "@open-game-system/ogs-protocol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GameArt } from "../GameArt";
import { colors, fonts } from "../theme";

/**
 * One Library game, full width: art, name and tagline, "Needs a TV" when it does, a chevron to its
 * page. The Library is the games you have, not their state: sittings live on the game's page.
 */
export function LibraryRow({
  game,
  needsTv,
  onPress,
  testID,
}: {
  game: Manifest;
  needsTv: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${game.name}${needsTv ? ", needs a TV" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <GameArt game={game} style={styles.art} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {game.name}
        </Text>
        {game.tagline ? (
          <Text style={styles.tagline} numberOfLines={2}>
            {game.tagline}
          </Text>
        ) : null}
        {needsTv ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              Needs a TV
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.chevron} />
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
  tagline: { color: colors.cream3, fontSize: 14, lineHeight: 19 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.dusk3,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { color: colors.cream2, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
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
