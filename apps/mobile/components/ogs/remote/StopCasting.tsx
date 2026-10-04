import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, TARGET } from "../theme";
import { feel, IDS } from "./press";

/**
 * Stop casting: a quiet control in the header, away from the thumb's path over the d-pad. It asks
 * first in a sheet (the session keeps the game's place, so it's a soft stop, never a delete).
 */
export function StopCasting({
  tvName,
  gameName,
  onStop,
}: {
  tvName: string;
  gameName: string | null;
  onStop: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <Pressable
        testID={IDS.end}
        accessibilityRole="button"
        accessibilityLabel="Stop casting"
        onPress={() => setAsking(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.quiet, pressed && styles.quietOn]}
      >
        <SymbolView name="stop.fill" size={11} tintColor={colors.cream2} style={styles.sym} />
        <Text style={styles.quietText}>Stop casting</Text>
      </Pressable>
      <Modal
        visible={asking}
        transparent
        animationType="slide"
        onRequestClose={() => setAsking(false)}
      >
        <Pressable
          style={styles.scrim}
          accessibilityLabel="Keep casting"
          onPress={() => setAsking(false)}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          testID="remoteEndAsk"
        >
          <View style={styles.grab} />
          <Text style={styles.title}>Stop casting?</Text>
          <Text style={styles.body}>
            {tvName} goes back to its own screen.{" "}
            {gameName
              ? `${gameName} keeps its place: cast again to pick it back up.`
              : "Cast again any time from this tab."}
          </Text>
          <Pressable
            testID="remoteEndConfirm"
            accessibilityRole="button"
            onPress={() => {
              feel("end");
              setAsking(false);
              onStop();
            }}
            style={({ pressed }) => [styles.btn, styles.stop, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.stopText}>Stop casting</Text>
          </Pressable>
          <Pressable
            testID="remoteEndCancel"
            accessibilityRole="button"
            onPress={() => setAsking(false)}
            style={({ pressed }) => [styles.btn, styles.keep, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.keepText}>Keep casting</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  quiet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  quietOn: { backgroundColor: colors.dusk2 },
  sym: { width: 11, height: 11 },
  quietText: { color: colors.cream2, fontSize: 14, fontWeight: "600" },
  scrim: { flex: 1, backgroundColor: "rgba(10, 8, 20, 0.6)" },
  sheet: {
    backgroundColor: colors.dusk1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: colors.hair,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hair,
    marginBottom: 6,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  body: { color: colors.cream2, fontSize: 16, lineHeight: 23, marginBottom: 8 },
  btn: {
    minHeight: TARGET + 10,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stop: { backgroundColor: colors.ember },
  stopText: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  keep: { backgroundColor: colors.dusk2 },
  keepText: { color: colors.cream, fontSize: 17, fontWeight: "700" },
});
