import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RemoteButton } from "../../../services/remote";
import { colors, fonts } from "../theme";
import { feel, IDS } from "./press";

type Dir = "up" | "down" | "left" | "right";

const SIZE = 256;
const OK = 104;
const GROOVE = OK + 18;
const EDGE = (SIZE - OK) / 2; // depth of each arrow's hit area (76pt)
const SPAN = 112; // width of each arrow's hit area
const RING = SIZE + 34;
const DOTS = 44;

const LABEL: Record<Dir, string> = { up: "Up", down: "Down", left: "Left", right: "Right" };
const SYMBOL = {
  up: "chevron.up",
  down: "chevron.down",
  left: "chevron.left",
  right: "chevron.right",
} as const;
const PLACE: Record<Dir, object> = {
  up: { top: 0, left: (SIZE - SPAN) / 2, width: SPAN, height: EDGE },
  down: { bottom: 0, left: (SIZE - SPAN) / 2, width: SPAN, height: EDGE },
  left: { left: 0, top: (SIZE - SPAN) / 2, width: EDGE, height: SPAN },
  right: { right: 0, top: (SIZE - SPAN) / 2, width: EDGE, height: SPAN },
};

/** The OGS dotted path, closed into a ring around the pad: the TV's focus ring, in your hand. */
function DottedRing() {
  return (
    <View pointerEvents="none" style={styles.ring}>
      {Array.from({ length: DOTS }, (_, i) => {
        const a = (i / DOTS) * Math.PI * 2;
        const cardinal = i % (DOTS / 4) === 0;
        const d = cardinal ? 6 : 3;
        const r = RING / 2 - 4;
        return (
          <View
            key={a}
            style={{
              position: "absolute",
              width: d,
              height: d,
              borderRadius: d / 2,
              left: RING / 2 + r * Math.sin(a) - d / 2,
              top: RING / 2 - r * Math.cos(a) - d / 2,
              backgroundColor: cardinal ? colors.lamp : colors.cream,
              opacity: cardinal ? 0.9 : 0.22,
            }}
          />
        );
      })}
    </View>
  );
}

function Arrow({ dir, onPress }: { dir: Dir; onPress: (b: RemoteButton) => void }) {
  return (
    <Pressable
      testID={IDS[dir]}
      accessibilityRole="button"
      accessibilityLabel={LABEL[dir]}
      onPressIn={() => feel(dir)}
      onPress={() => onPress(dir)}
      style={[styles.arrow, PLACE[dir]]}
    >
      {({ pressed }) => (
        <View style={[styles.arrowFace, pressed && styles.arrowFaceOn]}>
          <SymbolView
            name={SYMBOL[dir]}
            size={30}
            weight="bold"
            tintColor={pressed ? colors.lamp : colors.cream}
            style={styles.symbol}
          />
        </View>
      )}
    </Pressable>
  );
}

/** A big tactile d-pad: four arrow zones (each ≥ 76 × 112 pt) around a peach OK. */
export function DPad({ onPress }: { onPress: (b: RemoteButton) => void }) {
  return (
    <View style={styles.frame}>
      <DottedRing />
      <View style={styles.pad}>
        <LinearGradient
          colors={[colors.padTop, colors.padBottom]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {(["up", "down", "left", "right"] as const).map((dir) => (
          <Arrow key={dir} dir={dir} onPress={onPress} />
        ))}
        <View style={styles.groove}>
          <Pressable
            testID={IDS.ok}
            accessibilityRole="button"
            accessibilityLabel="OK"
            onPressIn={() => feel("ok")}
            onPress={() => onPress("ok")}
            style={({ pressed }) => [styles.ok, pressed && styles.okOn]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: RING, height: RING },
  pad: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.padEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { position: "absolute", alignItems: "center", justifyContent: "center" },
  arrowFace: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowFaceOn: { backgroundColor: colors.lampGlow },
  symbol: { width: 30, height: 30 },
  groove: {
    width: GROOVE,
    height: GROOVE,
    borderRadius: GROOVE / 2,
    backgroundColor: colors.groove,
    alignItems: "center",
    justifyContent: "center",
  },
  ok: {
    width: OK,
    height: OK,
    borderRadius: OK / 2,
    backgroundColor: colors.peach,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 2,
    borderTopColor: colors.peachLit,
  },
  okOn: { backgroundColor: colors.peachPressed, transform: [{ scale: 0.95 }] },
  okText: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
});
