import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "../Button";
import { colors, fonts } from "../theme";
import { TvHero } from "./TvHero";

/**
 * Onboarding's first page: what OGS is now (cast once, the TV is the console) and two equal paths,
 * a new profile or one this person already has (spec ogs-profiles, 1 · Onboarding).
 */
export function WelcomeStep({
  onMakeProfile,
  onSignIn,
}: {
  onMakeProfile: () => void;
  onSignIn: () => void;
}) {
  // A small phone (SE): a smaller heading, so "Your TV is the console" keeps to one line.
  const small = useWindowDimensions().width < 380;
  return (
    <View style={styles.page} testID="onboardingWelcome">
      <View style={styles.middle}>
        <TvHero compact={small} />
        <View style={styles.text}>
          <Text style={[styles.heading, small && styles.headingSmall]} accessibilityRole="header">
            Your TV is the console
          </Text>
          <Text style={styles.body}>
            Cast once from your phone. Then everyone plays together on the TV.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Make my profile" testID="onboardingMakeProfile" onPress={onMakeProfile} />
        <Button
          label="I already have a profile"
          kind="ghost"
          testID="onboardingSignIn"
          style={styles.second}
          onPress={onSignIn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 24, paddingBottom: 16 },
  middle: { flex: 1, justifyContent: "space-evenly" },
  text: { gap: 8 },
  heading: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 40,
    color: colors.cream,
    textAlign: "center",
  },
  headingSmall: { fontSize: 30, lineHeight: 36 },
  body: {
    color: colors.cream2,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
  actions: { gap: 12, paddingTop: 24 },
  // The second path: clearly a button too (a firmer outline than the app's quiet ghost).
  second: { borderColor: "rgba(251, 242, 228, 0.28)", backgroundColor: colors.dusk2 },
});
