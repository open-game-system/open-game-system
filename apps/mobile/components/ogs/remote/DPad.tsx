import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RemoteButton } from "../../../services/remote";
import { colors, fonts } from "../theme";
import { feel, IDS } from "./press";

type Dir = "up" | "down" | "left" | "right";

const DIRS = ["up", "down", "left", "right"] as const;
const LABEL: Record<Dir, string> = { up: "Up", down: "Down", left: "Left", right: "Right" };
const SYMBOL = {
  up: "chevron.up",
  down: "chevron.down",
  left: "chevron.left",
  right: "chevron.right",
} as const;
const DOTS = 44;
/** The dotted ring sits this far outside the pad. */
export const RING_GAP = 12;

/** Every measure of the pad from its diameter, so it can grow into the room the screen has. */
function geometry(size: number) {
  const r = size / 2;
  const ok = Math.round(size * 0.4);
  const groove = ok + 16;
  const edge = (size - ok) / 2; // depth of each arrow's hit area
  const span = Math.round(size * 0.44); // width of each arrow's hit area
  const wedge = r * Math.SQRT2; // a square turned 45° about the rim point: clipped by the pad, a quarter
  const box: Record<Dir, { left: number; top: number; width: number; height: number }> = {
    up: { left: (size - span) / 2, top: 0, width: span, height: edge },
    down: { left: (size - span) / 2, top: size - edge, width: span, height: edge },
    left: { left: 0, top: (size - span) / 2, width: edge, height: span },
    right: { left: size - edge, top: (size - span) / 2, width: edge, height: span },
  };
  const rim: Record<Dir, { x: number; y: number }> = {
    up: { x: r, y: 0 },
    down: { x: r, y: size },
    left: { x: 0, y: r },
    right: { x: size, y: r },
  };
  return { r, ok, groove, edge, span, wedge, box, rim, ring: size + RING_GAP * 2 };
}

type Geo = ReturnType<typeof geometry>;

/** The OGS dotted path, closed into a ring around the pad: the TV's focus ring, in your hand. */
function DottedRing({ ring }: { ring: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: ring, height: ring }}>
      {Array.from({ length: DOTS }, (_, i) => {
        const a = (i / DOTS) * Math.PI * 2;
        const cardinal = i % (DOTS / 4) === 0;
        const d = cardinal ? 6 : 3;
        const r = ring / 2 - 4;
        return (
          <View
            key={a}
            style={{
              position: "absolute",
              width: d,
              height: d,
              borderRadius: d / 2,
              left: ring / 2 + r * Math.sin(a) - d / 2,
              top: ring / 2 - r * Math.cos(a) - d / 2,
              backgroundColor: cardinal ? colors.lamp : colors.cream,
              opacity: cardinal ? 0.9 : 0.22,
            }}
          />
        );
      })}
    </View>
  );
}

function Arrow({ dir, geo, onPress }: { dir: Dir; geo: Geo; onPress: (b: RemoteButton) => void }) {
  const box = geo.box[dir];
  const rim = geo.rim[dir];
  return (
    <Pressable
      testID={IDS[dir]}
      accessibilityRole="button"
      accessibilityLabel={LABEL[dir]}
      onPressIn={() => feel(dir)}
      onPress={() => onPress(dir)}
      style={[styles.arrow, box]}
    >
      {({ pressed }) => (
        <>
          {pressed ? (
            // The lit quarter of the pad under your thumb (the pad's round edge clips the square).
            <View
              pointerEvents="none"
              style={[
                styles.wedge,
                {
                  width: geo.wedge,
                  height: geo.wedge,
                  left: rim.x - geo.wedge / 2 - box.left,
                  top: rim.y - geo.wedge / 2 - box.top,
                },
              ]}
            />
          ) : null}
          {pressed ? <View pointerEvents="none" style={styles.glow} /> : null}
          <SymbolView
            name={SYMBOL[dir]}
            size={26}
            weight="semibold"
            tintColor={pressed ? colors.lamp : colors.cream}
            style={styles.symbol}
          />
        </>
      )}
    </Pressable>
  );
}

/** A big flat clickpad: four arrow quarters around a peach OK, a dotted ring around it all. */
export function DPad({ size, onPress }: { size: number; onPress: (b: RemoteButton) => void }) {
  const geo = geometry(size);
  return (
    <View
      style={{ width: geo.ring, height: geo.ring, alignItems: "center", justifyContent: "center" }}
    >
      <DottedRing ring={geo.ring} />
      <View style={[styles.pad, { width: size, height: size, borderRadius: geo.r }]}>
        {/* Seams between the quarters, like a clickpad's four switches. */}
        {[45, -45].map((deg) => (
          <View
            key={deg}
            pointerEvents="none"
            style={[
              styles.seam,
              { width: size, left: 0, top: geo.r, transform: [{ rotate: `${deg}deg` }] },
            ]}
          />
        ))}
        {DIRS.map((dir) => (
          <Arrow key={dir} dir={dir} geo={geo} onPress={onPress} />
        ))}
        <View
          style={[
            styles.groove,
            { width: geo.groove, height: geo.groove, borderRadius: geo.groove / 2 },
          ]}
        >
          <Pressable
            testID={IDS.ok}
            accessibilityRole="button"
            accessibilityLabel="OK"
            onPressIn={() => feel("ok")}
            onPress={() => onPress("ok")}
            style={({ pressed }) => [
              styles.ok,
              { width: geo.ok, height: geo.ok, borderRadius: geo.ok / 2 },
              pressed && styles.okOn,
            ]}
          >
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    overflow: "hidden",
    backgroundColor: colors.padFace,
    borderWidth: 1,
    borderColor: colors.padEdge,
    alignItems: "center",
    justifyContent: "center",
  },
  seam: { position: "absolute", height: 1, backgroundColor: colors.padSeam },
  arrow: { position: "absolute", alignItems: "center", justifyContent: "center" },
  wedge: { position: "absolute", backgroundColor: colors.keyLit, transform: [{ rotate: "45deg" }] },
  glow: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.keyGlow,
  },
  symbol: { width: 26, height: 26 },
  groove: { backgroundColor: colors.groove, alignItems: "center", justifyContent: "center" },
  ok: { backgroundColor: colors.peach, alignItems: "center", justifyContent: "center" },
  okOn: { backgroundColor: colors.peachDeep, transform: [{ scale: 0.92 }] },
  okText: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
});
