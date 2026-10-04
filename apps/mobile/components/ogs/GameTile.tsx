import type { Manifest } from "@open-game-system/ogs-protocol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GameArt } from "./GameArt";
import { colors } from "./theme";

export function GameTile({
  game,
  status,
  onPress,
  testID,
}: {
  game: Manifest;
  status: string;
  onPress: () => void;
  testID?: string;
}) {
  const isNew = status === "New";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${game.name}, ${status}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
    >
      <GameArt game={game} style={styles.art} />
      <Text style={styles.name} numberOfLines={1}>
        {game.name}
      </Text>
      <View style={[styles.status, isNew ? styles.statusNew : styles.statusPaused]}>
        <Text style={[styles.statusText, isNew && styles.statusTextNew]} numberOfLines={1}>
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0 },
  art: { aspectRatio: 16 / 10, width: "100%" },
  name: { marginTop: 8, color: colors.cream, fontSize: 17, fontWeight: "700" },
  status: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  statusNew: { backgroundColor: colors.lilac },
  statusPaused: { borderWidth: 1, borderColor: colors.hair },
  statusText: { color: colors.cream2, fontSize: 13, fontWeight: "700" },
  statusTextNew: { color: colors.ink },
});
