import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { qrRuns } from "./friends-view";

/** A QR code drawn with Views (no native module): dark runs on white, with a 4-module margin. */
export function QrCode({
  value,
  size = 220,
  testID,
}: {
  value: string;
  size?: number;
  testID?: string;
}) {
  const { size: modules, rows } = useMemo(() => qrRuns(value), [value]);
  const cell = size / (modules + 8);
  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel="Your friend code as a QR code"
      style={[styles.paper, { width: size, height: size, padding: cell * 4 }]}
    >
      {rows.flat().map((r) => (
        <View
          key={`${r.y}-${r.x}`}
          style={[
            styles.dark,
            { left: cell * (4 + r.x), top: cell * (4 + r.y), width: cell * r.w, height: cell },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: "#ffffff", borderRadius: 16 },
  dark: { position: "absolute", backgroundColor: "#000000" },
});
