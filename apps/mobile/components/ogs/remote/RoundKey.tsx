import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RemoteButton } from "../../../services/remote";
import { colors } from "../theme";
import { feel, IDS } from "./press";

const KEY = 64;
const META = {
  back: { label: "Back", symbol: "arrow.uturn.backward" },
  home: { label: "Home", symbol: "house.fill" },
} as const;

/** Back / Home: round secondary keys with their name under them, like a real remote. */
export function RoundKey({
  button,
  onPress,
}: {
  button: "back" | "home";
  onPress: (b: RemoteButton) => void;
}) {
  const meta = META[button];
  return (
    <Pressable
      testID={IDS[button]}
      accessibilityRole="button"
      accessibilityLabel={meta.label}
      onPressIn={() => feel(button)}
      onPress={() => onPress(button)}
      style={styles.hit}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.key, pressed && styles.keyOn]}>
            <SymbolView
              name={meta.symbol}
              size={24}
              weight="semibold"
              tintColor={pressed ? colors.lamp : colors.cream}
              style={styles.symbol}
            />
          </View>
          <Text style={styles.label}>{meta.label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { alignItems: "center", gap: 8, minWidth: 88 },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    backgroundColor: colors.dusk2,
    borderWidth: 1,
    borderColor: colors.padEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  keyOn: { backgroundColor: colors.dusk3, transform: [{ scale: 0.94 }] },
  symbol: { width: 24, height: 24 },
  label: { color: colors.cream2, fontSize: 14, fontWeight: "600", letterSpacing: 0.2 },
});
