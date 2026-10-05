import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoneStep } from "../components/ogs/onboarding/DoneStep";
import { NotificationsStep } from "../components/ogs/onboarding/NotificationsStep";
import { ProfileStep } from "../components/ogs/onboarding/ProfileStep";
import { WelcomeStep } from "../components/ogs/onboarding/WelcomeStep";
import { colors, fonts, TARGET } from "../components/ogs/theme";
import { markOnboardingComplete } from "../services/onboarding";
import {
  animatesMove,
  backFrom,
  nextFrom,
  ONBOARDING_PAGES,
  showsBack,
  showsSkip,
  skipTo,
} from "../services/onboarding-steps";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PageProps = {
  onNext: () => void;
  onDone: () => void;
  onSignIn: () => void;
  onBackUp: () => void;
};

const PAGE_COMPONENTS: Record<(typeof ONBOARDING_PAGES)[number], React.ComponentType<PageProps>> = {
  welcome: ({ onNext, onSignIn }) => <WelcomeStep onMakeProfile={onNext} onSignIn={onSignIn} />,
  notifications: NotificationsStep,
  profile: ProfileStep,
  done: DoneStep,
};

const PAGES = ONBOARDING_PAGES.map((key, index) => ({ key, index }));
type OnboardingPage = (typeof PAGES)[number];

function PageDots({ currentPage }: { currentPage: number }) {
  return (
    <View style={styles.dotsContainer}>
      {PAGES.map(({ index: i }) => (
        <View
          key={i}
          testID={`pageDot-${i}-${i === currentPage ? "active" : "inactive"}`}
          style={[styles.dot, i === currentPage && styles.dotActive]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [notificationsAlreadyGranted, setNotificationsAlreadyGranted] = useState(false);

  // Whether notifications are already granted is a native query (an effect is the sync point).
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationsAlreadyGranted(status === "granted");
    });
  }, []);

  const handleComplete = useCallback(async () => {
    await markOnboardingComplete();
    router.replace("/");
  }, [router]);

  // Slides to the page next door; jumps across a page it passes over (e.g. granted notifications).
  const scrollTo = useCallback((from: number, index: number) => {
    const animated = animatesMove(from, index);
    flatListRef.current?.scrollToIndex({ index, animated });
    if (!animated) setCurrentPage(index);
  }, []);

  const goNext = useCallback(
    (from: number) => {
      const next = nextFrom(from, notificationsAlreadyGranted);
      if (next === "finish") void handleComplete();
      else scrollTo(from, next);
    },
    [handleComplete, notificationsAlreadyGranted, scrollTo],
  );

  // Pages stay mounted: going back keeps what was typed (name, @id, sticker).
  // The keyboard goes with the page it was typing on (it would cover the page Back returns to).
  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    scrollTo(currentPage, backFrom(currentPage, notificationsAlreadyGranted));
  }, [currentPage, notificationsAlreadyGranted, scrollTo]);
  const handleSkip = useCallback(() => scrollTo(currentPage, skipTo()), [currentPage, scrollTo]);
  const handleSignIn = useCallback(() => {
    router.push({ pathname: "/sign-in", params: { mode: "signin" } });
  }, [router]);
  const handleBackUp = useCallback(() => {
    router.push({ pathname: "/sign-in", params: { mode: "backup" } });
  }, [router]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentPage(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<OnboardingPage>) => {
      const PageComponent = PAGE_COMPONENTS[item.key];
      return (
        <View style={{ width: SCREEN_WIDTH }}>
          <PageComponent
            onNext={() => goNext(item.index)}
            onDone={() => void handleComplete()}
            onSignIn={handleSignIn}
            onBackUp={handleBackUp}
          />
        </View>
      );
    },
    [goNext, handleComplete, handleSignIn, handleBackUp],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="onboardingScreen">
      <StatusBar style="light" />

      {/* Back (top left) on every page after the welcome; Skip (top right) past the intro. */}
      <View style={styles.topBar}>
        {showsBack(currentPage) ? (
          <Pressable
            testID="onboardingBack"
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={handleBack}
            style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
          >
            <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={colors.cream} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : currentPage === 0 ? (
          <Text style={styles.wordmark} accessibilityLabel="OGS">
            OGS
          </Text>
        ) : (
          <View style={styles.topButton} />
        )}
        {showsSkip(currentPage) ? (
          <Pressable
            testID="onboardingSkipButton"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleSkip}
            style={({ pressed }) => [styles.topButton, styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        // Buttons move between pages (Back, Next, Skip). No swiping: a swipe forward would pass the
        // profile step without a profile.
        scrollEnabled={false}
        // The profile step's Next sits outside its own scroll view: with the keyboard up, a tap on
        // it must press it (the pager would otherwise swallow the tap to close the keyboard).
        keyboardShouldPersistTaps="handled"
        // Every page stays mounted, so Back keeps what was typed.
        windowSize={PAGES.length * 2 + 1}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.pager}
      />

      <View style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <PageDots currentPage={currentPage} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk0 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: TARGET,
  },
  topButton: {
    minHeight: TARGET,
    minWidth: TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  pressed: { opacity: 0.6 },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.lamp,
    letterSpacing: 1.5,
    paddingHorizontal: 12,
  },
  backText: { color: colors.cream, fontSize: 17, fontWeight: "600" },
  skip: { justifyContent: "flex-end" },
  skipText: { color: colors.cream3, fontSize: 17, fontWeight: "600" },
  pager: { flex: 1 },
  bottomArea: { alignItems: "center", paddingTop: 12 },
  dotsContainer: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dusk3 },
  dotActive: { width: 24, backgroundColor: colors.peach },
});
