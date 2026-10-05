import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useApp } from "../../../services/runtime";
import { Button } from "../Button";
import { backupView, greeting, profileView } from "../profile/profile-view";
import { colors, fonts } from "../theme";
import { TvHero } from "./TvHero";

/** Onboarding's last page (spec ogs-profiles, 1 · 02): back-up is offered, never required. */
export function DoneStep({ onDone, onBackUp }: { onDone: () => void; onBackUp: () => void }) {
  const app = useApp();
  const me = profileView(app.identity);
  const backup = backupView(app.logins);
  const small = useWindowDimensions().width < 380;
  return (
    <View style={styles.page} testID="profileDone">
      {/* The welcome's TV again, now with you on the couch. */}
      <TvHero
        compact={small}
        sitters={[me?.sticker ?? "bear"]}
        stickerSize={small ? 76 : 92}
        chip={null}
        maxWidth={small ? 240 : 280}
      />
      <Text style={styles.heading} testID="profileDoneGreeting">
        {greeting(me?.name ?? "")}
      </Text>
      <Text style={styles.handle} testID="profileDoneHandle">
        {me?.handle ?? ""}
      </Text>
      <Text style={styles.body}>Games see your name, @id and sticker. Nothing else.</Text>
      <View style={styles.actions}>
        <Button label="Let's go" testID="onboardingLetsGoButton" onPress={onDone} />
        {backup.backedUp ? (
          <Text style={styles.backed} testID="profileDoneBackedUp">
            {backup.label}
          </Text>
        ) : (
          <>
            <Button
              label="Back up your profile"
              kind="ghost"
              testID="profileDoneBackUp"
              onPress={onBackUp}
              style={styles.second}
            />
            <Text style={styles.why}>So you can sign in on a new phone.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 8 },
  heading: { fontFamily: fonts.display, fontSize: 34, color: colors.cream, marginTop: 14 },
  handle: { color: colors.peach, fontSize: 18, fontWeight: "700" },
  body: { color: colors.cream2, fontSize: 16, lineHeight: 22, textAlign: "center", maxWidth: 280 },
  actions: { alignSelf: "stretch", gap: 12, marginTop: 28 },
  why: { color: colors.cream3, fontSize: 14, textAlign: "center" },
  second: { borderColor: "rgba(251, 242, 228, 0.28)", backgroundColor: colors.dusk2 },
  backed: { color: colors.mint, fontSize: 15, fontWeight: "700", textAlign: "center" },
});
