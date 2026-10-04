import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

/** A small status chip on art: "On Living room TV" with a live dot, "Your turn", "On this phone". */
export function StatusTag({ label, live = false }: { label: string; live?: boolean }) {
  return (
    <View style={styles.tag}>
      {live ? <View style={styles.dot} /> : null}
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(18, 15, 34, 0.78)",
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember },
  text: { color: colors.cream, fontSize: 13, fontWeight: "700" },
});
