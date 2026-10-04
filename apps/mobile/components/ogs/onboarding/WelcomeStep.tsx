import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "../Button";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";

/** The family on the couch in front of the TV (painted stickers, never initials). */
const COUCH = ["bear", "owl", "dragon", "whale"] as const;

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
        <View style={[styles.hero, small && styles.heroSmall]}>
          <View style={styles.halo} />
          <View style={styles.tv}>
            <LinearGradient
              colors={[colors.dusk3, colors.dusk2, "#4a3247"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.screen}
            >
              <View style={styles.glow} />
              <Text style={styles.mark}>OGS</Text>
            </LinearGradient>
          </View>
          <View style={styles.couch}>
            {COUCH.map((id, i) => (
              <View key={id} style={i === 0 ? null : styles.next}>
                <Sticker id={id} size={60} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.text}>
          <Text style={[styles.heading, small && styles.headingSmall]} accessibilityRole="header">
            Your TV is the console
          </Text>
          <Text style={styles.body}>
            Cast once from this phone. Then your family and friends play together on the TV.
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
  middle: { flex: 1, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 28, paddingTop: 16 },
  heroSmall: { marginBottom: 20 },
  // The TV's warm light on the wall behind it (its own view: a shadow would be clipped).
  halo: {
    position: "absolute",
    top: 0,
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 200, 97, 0.07)",
    transform: [{ scaleX: 1.15 }],
  },
  tv: {
    width: "86%",
    maxWidth: 340,
    aspectRatio: 16 / 10,
    borderRadius: 22,
    padding: 7,
    backgroundColor: colors.dusk1,
    borderWidth: 1.5,
    borderColor: colors.hair,
  },
  screen: {
    flex: 1,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    height: "88%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255, 200, 97, 0.10)",
  },
  mark: {
    fontFamily: fonts.display,
    fontSize: 44,
    color: colors.lamp,
    letterSpacing: 2,
  },
  couch: { flexDirection: "row", alignItems: "flex-end", marginTop: -26 },
  next: { marginLeft: -6 },
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
