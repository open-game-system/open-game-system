import * as Notifications from "expo-notifications";
import { SymbolView } from "expo-symbols";
import { useCallback } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "../Button";
import { colors, fonts } from "../theme";
import { TvHero } from "./TvHero";

const BENEFITS = [
  "Turn alerts for board games",
  "Game invites from friends",
  "Live game countdowns",
] as const;

/** Onboarding's notifications page: ask, or Maybe Later. Either way on to the profile step. */
export function NotificationsStep({ onNext }: { onNext: () => void }) {
  const small = useWindowDimensions().width < 380;
  const enable = useCallback(async () => {
    await Notifications.requestPermissionsAsync();
    onNext();
  }, [onNext]);

  return (
    <View style={styles.page}>
      <View style={[styles.hero, small && styles.heroSmall]}>
        <TvHero
          compact={small}
          sitters={["owl"]}
          stickerSize={small ? 48 : 72}
          chip="Your turn"
          chipIcon="bell.fill"
          maxWidth={small ? 190 : 280}
        />
      </View>
      <Text style={[styles.heading, small && styles.headingSmall]} accessibilityRole="header">
        Stay in the game
      </Text>
      <Text style={styles.body}>We'll tell you when it's your turn.</Text>
      <View style={[styles.benefits, small && styles.benefitsSmall]}>
        {BENEFITS.map((text) => (
          <View key={text} style={styles.benefit}>
            <View style={[styles.check, small && styles.checkSmall]}>
              <SymbolView name="checkmark" size={15} tintColor={colors.mint} />
            </View>
            <Text style={styles.benefitText}>{text}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.actions, small && styles.actionsSmall]}>
        <Button
          label="Turn on notifications"
          testID="onboardingEnableNotificationsButton"
          onPress={() => void enable()}
        />
        <Button
          label="Maybe later"
          kind="ghost"
          testID="onboardingMaybeLaterButton"
          style={styles.second}
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
  headingSmall: { fontSize: 30, lineHeight: 36 },
  heroSmall: { marginBottom: 4 },
  benefits: { gap: 14, marginTop: 24, paddingHorizontal: 8, alignSelf: "center" },
  benefitsSmall: { gap: 6, marginTop: 16 },
  actionsSmall: { marginTop: 14 },
  checkSmall: { width: 28, height: 28, borderRadius: 14 },
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
  second: { borderColor: "rgba(251, 242, 228, 0.28)", backgroundColor: colors.dusk2 },
});
