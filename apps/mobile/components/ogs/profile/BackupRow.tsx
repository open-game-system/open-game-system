import { StyleSheet, Text, View } from "react-native";
import { Button } from "../Button";
import { colors } from "../theme";

/** "Not backed up" with Back up, or "Backed up with Google". */
export function BackupRow({
  backedUp,
  label,
  onBackUp,
}: {
  backedUp: boolean;
  label: string;
  onBackUp: () => void;
}) {
  return (
    <View style={styles.row} testID="profileBackup">
      <Text style={[styles.label, backedUp && styles.ok]} testID="profileBackupStatus">
        {label}
      </Text>
      {backedUp ? null : <Button label="Back up" testID="profileBackUp" onPress={onBackUp} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  label: { flex: 1, color: colors.cream, fontSize: 17, fontWeight: "700" },
  ok: { color: colors.mint },
});
