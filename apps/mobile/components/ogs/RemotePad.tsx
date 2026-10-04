import { StyleSheet, View } from "react-native";
import type { RemoteButton } from "../../services/remote";
import { DPad, RING_GAP } from "./remote/DPad";
import { RoundKey } from "./remote/RoundKey";

/** The pad's diameter for the room it has: big in the thumb zone, never past the corner keys. */
export const padSize = (room: number) => Math.max(200, Math.min(256, room - RING_GAP * 2));

/**
 * The TV tab once cast: the clickpad in the thumb zone, Back and Home flanking its lower half
 * like a real remote's corner keys.
 */
export function RemotePad({ size, onPress }: { size: number; onPress: (b: RemoteButton) => void }) {
  return (
    <View style={[styles.wrap, { height: size + RING_GAP * 2 }]}>
      <DPad size={size} onPress={onPress} />
      <View style={[styles.corner, styles.left]}>
        <RoundKey button="back" onPress={onPress} />
      </View>
      <View style={[styles.corner, styles.right]}>
        <RoundKey button="home" onPress={onPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", bottom: 0 },
  left: { left: -6 },
  right: { right: -6 },
});
