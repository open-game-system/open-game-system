import { StyleSheet, Text, View } from "react-native";
import { useApp } from "../../../services/runtime";
import { Button } from "../Button";
import { backupView, greeting, profileView } from "../profile/profile-view";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";

/** Onboarding's last page (spec ogs-profiles, 1 · 02): back-up is offered, never required. */
export function DoneStep({ onDone, onBackUp }: { onDone: () => void; onBackUp: () => void }) {
  const app = useApp();
  const me = profileView(app.identity);
  const backup = backupView(app.logins);
  return (
    <View style={styles.page} testID="profileDone">
      <Sticker id={me?.sticker ?? "bear"} size={112} />
      <Text style={styles.heading} testID="profileDoneGreeting">
        {greeting(me?.name ?? "")}
      </Text>
      <Text style={styles.handle} testID="profileDoneHandle">
        {me?.handle ?? ""}
      </Text>
      <Text style={styles.body}>
        Games see your @id, name and sticker. Never your friends or other games.
      </Text>
      <View style={styles.actions}>
        <Button label="Let's go" testID="onboardingLetsGoButton" onPress={onDone} />
        {backup.backedUp ? (
          <Text style={styles.backed} testID="profileDoneBackedUp">
            {backup.label}
          </Text>
        ) : (
          <Button
            label="Back up your profile"
            kind="ghost"
            testID="profileDoneBackUp"
            onPress={onBackUp}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 10 },
  heading: { fontFamily: fonts.display, fontSize: 32, color: colors.cream, marginTop: 10 },
  handle: { color: colors.peach, fontSize: 18, fontWeight: "700" },
  body: { color: colors.cream2, fontSize: 16, lineHeight: 22, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: 10, marginTop: 24 },
  backed: { color: colors.mint, fontSize: 15, fontWeight: "700", textAlign: "center" },
});
