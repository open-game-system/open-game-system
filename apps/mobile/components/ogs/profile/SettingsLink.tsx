import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SectionTitle } from "../Screen";
import { colors, TARGET } from "../theme";

/** The old household button's job: one row into the Settings screen (app/settings.tsx). */
export function SettingsLink({ onPress }: { onPress: () => void }) {
  return (
    <View>
      <SectionTitle>Settings</SectionTitle>
      <Pressable
        testID="profileSettings"
        accessibilityRole="button"
        accessibilityLabel="Settings: notifications, sounds, developer, about"
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <SymbolView name="gearshape.fill" size={22} tintColor={colors.cream2} style={styles.icon} />
        <View style={styles.text}>
          <Text style={styles.label}>Settings</Text>
          <Text style={styles.hint}>Notifications, sounds, developer, about</Text>
        </View>
        <SymbolView name="chevron.right" size={15} tintColor={colors.cream3} style={styles.chev} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TARGET + 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  pressed: { opacity: 0.8 },
  icon: { width: 26, height: 26 },
  text: { flex: 1, gap: 2 },
  label: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  hint: { color: colors.cream3, fontSize: 14 },
  chev: { width: 12, height: 16 },
});
