import { StyleSheet, View } from "react-native";
import type { RemoteButton } from "../../services/remote";
import { DPad } from "./remote/DPad";
import { RoundKey } from "./remote/RoundKey";

/** The TV tab once cast: a big d-pad for the launcher's focus ring, then Back and Home. */
export function RemotePad({ onPress }: { onPress: (b: RemoteButton) => void }) {
  return (
    <View style={styles.wrap}>
      <DPad onPress={onPress} />
      <View style={styles.row}>
        <RoundKey button="back" onPress={onPress} />
        <RoundKey button="home" onPress={onPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingHorizontal: 18,
  },
});
