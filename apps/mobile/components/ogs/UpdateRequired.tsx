import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, fonts } from "./theme";

/**
 * Shown over everything when this build is older than the latest beta release
 * (services/app-release.ts). There is no way past it: Update opens TestFlight / Firebase App Tester.
 */
export function UpdateRequired({ onUpdate }: { onUpdate: () => void }) {
  return (
    <View style={styles.screen} testID="updateRequired">
      <Text style={styles.title} accessibilityRole="header">
        Update OGS
      </Text>
      <Text style={styles.body}>A new version is ready. Update to keep playing.</Text>
      <Button
        label="Update"
        onPress={onUpdate}
        testID="updateRequired.update"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
    backgroundColor: colors.dusk0,
  },
  title: { color: colors.cream, fontSize: 30, fontFamily: fonts.display },
  body: { color: colors.cream2, fontSize: 17, textAlign: "center", maxWidth: 320 },
  button: { alignSelf: "stretch", maxWidth: 320, width: "100%", marginTop: 8 },
});
