import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Sticker } from "../Sticker";
import { colors } from "../theme";

/** Real games from the Library, bundled (the welcome shows before anything is downloaded). */
const GAMES: { hero: ImageSourcePropType; logo: ImageSourcePropType }[] = [
  {
    hero: require("../../../assets/onboarding/rocket-crew-hero.webp"),
    logo: require("../../../assets/onboarding/rocket-crew-logo.webp"),
  },
  {
    hero: require("../../../assets/onboarding/story-nook-hero.webp"),
    logo: require("../../../assets/onboarding/story-nook-logo.webp"),
  },
  {
    hero: require("../../../assets/onboarding/bake-shop-hero.webp"),
    logo: require("../../../assets/onboarding/bake-shop-logo.webp"),
  },
  {
    hero: require("../../../assets/onboarding/peekaboo-garden-hero.webp"),
    logo: require("../../../assets/onboarding/peekaboo-garden-logo.webp"),
  },
  {
    hero: require("../../../assets/onboarding/night-flight-hero.webp"),
    logo: require("../../../assets/onboarding/night-flight-logo.webp"),
  },
];

/** The family on the couch in front of the TV (the launcher's couch: painted stickers). */
const COUCH = ["bear", "owl", "dragon", "whale"] as const;

const HOLD_MS = 3600;
const FADE_MS = 700;

/**
 * The welcome's picture: a living-room TV playing a real game (games change every few seconds),
 * cast from a phone, with the family on the couch in front. Reduced motion: one still game.
 */
export function TvHero({
  compact,
  sitters = COUCH,
  stickerSize,
  chip = "Cast from your phone",
  maxWidth = 360,
}: {
  compact: boolean;
  /** Who's on the couch (sticker ids). */
  sitters?: readonly string[];
  stickerSize?: number;
  /** The label on the TV's corner chip; null for none. */
  chip?: string | null;
  maxWidth?: number;
}) {
  const [shown, setShown] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  // Animations follow the system's reduce-motion setting (an external system: an effect syncs it).
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        fade.setValue(1);
        return;
      }
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      timer = setInterval(() => {
        Animated.timing(fade, { toValue: 0, duration: FADE_MS / 2, useNativeDriver: true }).start(
          () => {
            setShown((i) => (i + 1) % GAMES.length);
            Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
          },
        );
      }, HOLD_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [fade]);

  const game = GAMES[shown];
  const sticker = stickerSize ?? (compact ? 48 : 58);
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel="A game on the TV, the family on the couch"
    >
      <View style={[styles.tv, { maxWidth }]}>
        <View style={styles.screen}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
            <Image source={game.hero} style={styles.art} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(18,15,34,0)", "rgba(18,15,34,0.55)"]}
              start={{ x: 0.5, y: 0.45 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Image source={game.logo} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>
        {chip ? (
          <View style={styles.castChip}>
            <SymbolView
              name="iphone.radiowaves.left.and.right"
              size={13}
              tintColor={colors.ink}
              weight="semibold"
            />
            <Text style={styles.castText}>{chip}</Text>
          </View>
        ) : null}
      </View>
      {/* The couch sits just in front of the TV: the sitters overlap its bottom edge a little. */}
      <View
        style={[styles.couch, { marginTop: -Math.round(sticker * 0.22), maxWidth: maxWidth * 0.8 }]}
      >
        <View style={styles.couchSeat} />
        <View style={styles.sitters}>
          {sitters.map((id) => (
            <Sticker key={id} id={id} size={sticker} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", alignSelf: "stretch" },
  tv: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 16 / 9.6,
    borderRadius: 14,
    padding: 5,
    backgroundColor: "#0b0916",
    borderWidth: 1,
    borderColor: colors.hair,
  },
  screen: { flex: 1, borderRadius: 9, overflow: "hidden", backgroundColor: colors.dusk1 },
  art: { width: "100%", height: "100%" },
  logo: { position: "absolute", left: "6%", bottom: "8%", width: "42%", height: "34%" },
  castChip: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.lamp,
  },
  castText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  couch: { alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 22 },
  couchSeat: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
    borderRadius: 18,
    backgroundColor: colors.dusk2,
    borderTopWidth: 1,
    borderTopColor: colors.hair,
  },
  sitters: { flexDirection: "row", gap: 2, paddingBottom: 8 },
});
