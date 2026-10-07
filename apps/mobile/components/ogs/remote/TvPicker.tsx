import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CastDevice } from "../../../services/cast-store";
import { colors, fonts, TARGET } from "../theme";

/**
 * A bottom sheet of the TVs in the room: the one you're casting to, the others to switch to, a
 * "Looking for TVs…" row while the search runs, and a plain empty state when it finds no other.
 */
export function TvPicker({
  visible,
  devices,
  currentId,
  switchingId,
  error,
  searching,
  onPick,
  onRescan,
  onClose,
}: {
  visible: boolean;
  devices: CastDevice[];
  currentId: string | null;
  switchingId: string | null;
  error: string | null;
  searching: boolean;
  onPick: (device: CastDevice) => void;
  onRescan: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const others = devices.filter((d) => d.id !== currentId).length;
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
                  {current
                    ? "Casting now"
                    : switching
                      ? `Switching to ${d.name}…`
                      : "Tap to move the TV here"}
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
        {searching ? (
          <View style={[styles.row, styles.looking]} testID="tvPickerLooking">
            <View style={styles.icon}>
              <ActivityIndicator color={colors.cream2} />
            </View>
            <Text style={styles.lookingText}>Looking for TVs…</Text>
          </View>
        ) : others === 0 ? (
          <View style={styles.empty} testID="tvPickerEmpty">
            <Text style={styles.emptyTitle}>No other TVs nearby</Text>
            <Text style={styles.foot}>
              A TV shows up here when it's on and on the same Wi-Fi as this phone.
            </Text>
            <Pressable
              testID="tvPickerRescan"
              accessibilityRole="button"
              onPress={onRescan}
              style={({ pressed }) => [styles.rescan, pressed && styles.rowPressed]}
            >
              <SymbolView
                name="arrow.clockwise"
                size={15}
                weight="semibold"
                tintColor={colors.cream}
                style={styles.rescanSym}
              />
              <Text style={styles.rescanText}>Look again</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? (
          <Text style={styles.error} testID="tvPickerError">
            {error}
          </Text>
        ) : null}
        {others > 0 ? (
          <Text style={styles.foot}>The game on the TV keeps its place when you switch.</Text>
        ) : null}
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
  status: { color: colors.cream2, fontSize: 15 },
  statusOn: { color: colors.mint },
  check: { width: 24, height: 24 },
  error: { color: colors.peach, fontSize: 15 },
  foot: { color: colors.cream3, fontSize: 14, lineHeight: 20, marginTop: 4 },
  looking: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.hair,
    borderStyle: "dashed",
  },
  lookingText: { color: colors.cream2, fontSize: 16, fontWeight: "600" },
  empty: { paddingTop: 6, gap: 4 },
  emptyTitle: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  rescan: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: TARGET,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 22,
    backgroundColor: colors.dusk2,
  },
  rescanSym: { width: 15, height: 15 },
  rescanText: { color: colors.cream, fontSize: 15, fontWeight: "700" },
});
