import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, TARGET } from "../theme";
import { feel, IDS } from "./press";
import type { CastControls } from "./remote-view";

/**
 * The remote's end control, away from the thumb's path over the pad: the caster's "Stop casting"
 * (in the header) or a joined phone's "Leave Mom's TV" (on the TV row). Both ask first in a sheet;
 * the session keeps the game's place, so it's a soft stop, never a delete.
 */
export function StopCasting({ end, onStop }: { end: CastControls["end"]; onStop: () => void }) {
  const [asking, setAsking] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <Pressable
        testID={IDS.end}
        accessibilityRole="button"
        accessibilityLabel={end.label}
        onPress={() => setAsking(true)}
        hitSlop={8}
        style={({ pressed }) => [styles.quiet, pressed && styles.quietOn]}
      >
        <SymbolView
          name="stop.circle"
          size={15}
          weight="semibold"
          tintColor={colors.cream2}
          style={styles.sym}
        />
        <Text style={styles.quietText}>{end.label}</Text>
      </Pressable>
      <Modal
        visible={asking}
        transparent
        animationType="slide"
        onRequestClose={() => setAsking(false)}
      >
        <Pressable
          style={styles.scrim}
          accessibilityLabel={end.keep}
          onPress={() => setAsking(false)}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
          testID="remoteEndAsk"
        >
          <View style={styles.grab} />
          <Text style={styles.title}>{end.title}</Text>
          <Text style={styles.body}>{end.body}</Text>
          <Pressable
            testID="remoteEndCancel"
            accessibilityRole="button"
            onPress={() => setAsking(false)}
            style={({ pressed }) => [styles.btn, styles.keep, pressed && styles.keepOn]}
          >
            <Text style={styles.keepText}>{end.keep}</Text>
          </Pressable>
          <Pressable
            testID="remoteEndConfirm"
            accessibilityRole="button"
            onPress={() => {
              feel("end");
              setAsking(false);
              onStop();
            }}
            style={({ pressed }) => [styles.btn, styles.stop, pressed && styles.stopOn]}
          >
            <Text style={styles.stopText}>{end.confirm}</Text>
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
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  quietOn: { backgroundColor: colors.dusk2 },
  sym: { width: 15, height: 15 },
  quietText: { color: colors.cream, fontSize: 15, fontWeight: "600" },
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
  keep: { backgroundColor: colors.dusk2 },
  keepOn: { backgroundColor: colors.dusk3 },
  keepText: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  stop: { borderWidth: 1.5, borderColor: colors.ember },
  stopOn: { backgroundColor: colors.emberGlow },
  stopText: { color: colors.ember, fontSize: 17, fontWeight: "800" },
});
