import * as Notifications from "expo-notifications";
import { SymbolView } from "expo-symbols";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../Button";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";

const BENEFITS = [
  "Turn alerts for board games",
  "Game invites from friends",
  "Live game countdowns",
] as const;

/** Onboarding's notifications page: ask, or Maybe Later. Either way on to the profile step. */
export function NotificationsStep({ onNext }: { onNext: () => void }) {
  const enable = useCallback(async () => {
    await Notifications.requestPermissionsAsync();
    onNext();
  }, [onNext]);

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Sticker id="owl" size={96} />
      </View>
      <Text style={styles.heading} accessibilityRole="header">
        Stay in the game
      </Text>
      <Text style={styles.body}>
        Get notified when it's your turn, when friends invite you, or when a live game is about to
        start.
      </Text>
      <View style={styles.benefits}>
        {BENEFITS.map((text) => (
          <View key={text} style={styles.benefit}>
            <View style={styles.check}>
              <SymbolView name="checkmark" size={15} tintColor={colors.mint} />
            </View>
            <Text style={styles.benefitText}>{text}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          label="Enable Notifications"
          testID="onboardingEnableNotificationsButton"
          onPress={() => void enable()}
        />
        <Button
          label="Maybe Later"
          kind="ghost"
          testID="onboardingMaybeLaterButton"
          onPress={onNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 20 },
  heading: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: colors.cream,
    textAlign: "center",
  },
  body: {
    color: colors.cream2,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 10,
  },
  benefits: { gap: 14, marginTop: 28, paddingHorizontal: 8 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 14 },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.dusk2,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { color: colors.cream, fontSize: 16 },
  actions: { gap: 12, marginTop: 32 },
});
