import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CastDevice } from "../../../services/cast-store";
import { colors, fonts, TARGET } from "../theme";

/** A bottom sheet of the TVs in the room: the one you're casting to, and the others to switch to. */
export function TvPicker({
  visible,
  devices,
  currentId,
  switchingId,
  error,
  onPick,
  onClose,
}: {
  visible: boolean;
  devices: CastDevice[];
  currentId: string | null;
  switchingId: string | null;
  error: string | null;
  onPick: (device: CastDevice) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} accessibilityLabel="Close" onPress={onClose} />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        testID="tvPicker"
      >
        <View style={styles.grab} />
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Cast to
          </Text>
          <Pressable
            testID="tvPickerClose"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.done}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        {devices.map((d) => {
          const current = d.id === currentId;
          const switching = d.id === switchingId;
          return (
            <Pressable
              key={d.id}
              testID={`tvPickerDevice-${d.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: current }}
              accessibilityLabel={current ? `${d.name}, casting now` : `Switch to ${d.name}`}
              disabled={switchingId !== null}
              onPress={() => onPick(d)}
              style={({ pressed }) => [
                styles.row,
                current && styles.rowOn,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={[styles.icon, current && styles.iconOn]}>
                <SymbolView
                  name="tv"
                  size={22}
                  weight="semibold"
                  tintColor={current ? colors.ink : colors.cream}
                  style={styles.sym}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={[styles.status, current && styles.statusOn]}>
                  {current ? "Casting now" : switching ? "Switching…" : "Tap to move the TV here"}
                </Text>
              </View>
              {switching ? (
                <ActivityIndicator color={colors.cream} />
              ) : current ? (
                <SymbolView
                  name="checkmark.circle.fill"
                  size={24}
                  tintColor={colors.mint}
                  style={styles.check}
                />
              ) : null}
            </Pressable>
          );
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.foot}>
          Don't see a TV? It needs to be on, and on the same Wi-Fi as this phone. The game on the TV
          keeps its place when you switch.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10, 8, 20, 0.6)" },
  sheet: {
    backgroundColor: colors.dusk1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.hair,
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hair,
    marginBottom: 4,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  done: { minHeight: TARGET, minWidth: TARGET, justifyContent: "center", alignItems: "flex-end" },
  doneText: { color: colors.peach, fontSize: 17, fontWeight: "700" },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.dusk2,
  },
  rowOn: { borderWidth: 1.5, borderColor: colors.mint },
  rowPressed: { backgroundColor: colors.dusk3 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.dusk3,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOn: { backgroundColor: colors.mint },
  sym: { width: 22, height: 22 },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  status: { color: colors.cream3, fontSize: 14 },
  statusOn: { color: colors.mint },
  check: { width: 24, height: 24 },
  error: { color: colors.peach, fontSize: 15 },
  foot: { color: colors.cream3, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
