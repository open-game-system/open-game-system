import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";
import { ROW_ART_WIDTH } from "./LibraryRow";

/** The last Library row: "+ Add games", shaped like a game row so the list ends on an invitation. */
export function AddGamesRow({ onPress, testID }: { onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="+ Add games"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.slot}>
        <View style={styles.plusH} />
        <View style={styles.plusV} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>Add games</Text>
        <Text style={styles.sub}>Free web games for the couch</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 84,
    // 10 like a game row, less the 1.5 dashed border, so the + slot lines up with the art above.
    padding: 8.5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.hair,
  },
  pressed: { backgroundColor: colors.dusk1 },
  slot: {
    width: ROW_ART_WIDTH,
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: colors.dusk2,
    alignItems: "center",
    justifyContent: "center",
  },
  plusH: {
    position: "absolute",
    width: 22,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.peach,
  },
  plusV: {
    position: "absolute",
    width: 2.5,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.peach,
  },
  text: { flex: 1, gap: 4 },
  label: { fontFamily: fonts.display, fontSize: 20, color: colors.cream },
  sub: { color: colors.cream3, fontSize: 14, fontWeight: "600" },
});
