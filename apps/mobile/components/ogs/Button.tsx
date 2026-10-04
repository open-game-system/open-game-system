import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { colors, TARGET } from "./theme";

export function Button({
  label,
  onPress,
  kind = "primary",
  testID,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost";
  testID?: string;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        kind === "primary" ? styles.primary : styles.ghost,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[styles.label, kind === "primary" ? styles.primaryLabel : styles.ghostLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TARGET + 8,
    borderRadius: 26,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.peach },
  ghost: { borderWidth: 1.5, borderColor: colors.hair, backgroundColor: colors.dusk1 },
  label: { fontSize: 17, fontWeight: "700" },
  primaryLabel: { color: colors.ink },
  ghostLabel: { color: colors.cream },
});
