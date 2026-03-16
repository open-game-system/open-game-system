import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
  type ListRenderItemInfo,
  type ViewToken,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { markOnboardingComplete } from '../services/onboarding';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingPage = {
  key: string;
  index: number;
  component: React.ComponentType<{ onNext: () => void }>;
};

// --- Page 1: What is OGS ---

function Page1(_props: { onNext: () => void }) {
  return (
    <View style={styles.page}>
      <View style={styles.heroArea}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>OGS</Text>
        </View>
        <View style={styles.pillarsRow}>
          <View style={styles.pillar}>
            <Text style={styles.pillarLabel}>Notifications</Text>
          </View>
          <View style={styles.pillarDivider} />
          <View style={styles.pillar}>
            <Text style={styles.pillarLabel}>TV Casting</Text>
          </View>
          <View style={styles.pillarDivider} />
          <View style={styles.pillar}>
            <Text style={styles.pillarLabel}>Native Feel</Text>
          </View>
        </View>
      </View>
      <View style={styles.textArea}>
        <Text style={styles.heading}>Web games, supercharged</Text>
        <Text style={styles.body}>
          OGS gives your favorite web games push notifications, TV casting, and
          a native app experience.
        </Text>
      </View>
    </View>
  );
}

// --- Page 2: Notifications ---

function Page2({ onNext }: { onNext: () => void }) {
  const handleEnableNotifications = useCallback(async () => {
    await Notifications.requestPermissionsAsync();
    onNext();
  }, [onNext]);

  return (
    <View style={styles.page}>
      <View style={styles.heroArea}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconEmoji}>🔔</Text>
        </View>
      </View>
      <View style={styles.textArea}>
        <Text style={styles.heading}>Stay in the game</Text>
        <Text style={styles.body}>
          Get notified when it's your turn, when friends invite you, or when a
          live game is about to start.
        </Text>
      </View>
      <View style={styles.benefitsList}>
        <BenefitRow text="Turn alerts for board games" />
        <BenefitRow text="Game invites from friends" />
        <BenefitRow text="Live game countdowns" />
      </View>
      <View style={styles.actionArea}>
        <TouchableOpacity
          testID="onboardingEnableNotificationsButton"
          style={styles.primaryButton}
          onPress={handleEnableNotifications}
        >
          <Text style={styles.primaryButtonText}>Enable Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="onboardingMaybeLaterButton"
          style={styles.secondaryButton}
          onPress={onNext}
        >
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BenefitRow({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.checkIcon}>
        <Text style={styles.checkText}>✓</Text>
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

// --- Page 3: Ready ---

function Page3({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.page}>
      <View style={styles.heroArea}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>OGS</Text>
        </View>
      </View>
      <View style={styles.textArea}>
        <Text style={styles.heading}>You're all set</Text>
        <Text style={styles.body}>
          Pick a game from the directory to start playing. Swipe from the left
          edge anytime to come back here.
        </Text>
      </View>
      <View style={styles.actionArea}>
        <TouchableOpacity
          testID="onboardingLetsGoButton"
          style={styles.primaryButton}
          onPress={onNext}
        >
          <Text style={styles.primaryButtonText}>Let's Go</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Page Dots ---

function PageDots({ currentPage }: { currentPage: number }) {
  return (
    <View style={styles.dotsContainer}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          testID={`pageDot-${i}-${i === currentPage ? 'active' : 'inactive'}`}
          style={[styles.dot, i === currentPage && styles.dotActive]}
        />
      ))}
    </View>
  );
}

// --- Main Onboarding Screen ---

const PAGES: OnboardingPage[] = [
  { key: 'page1', index: 0, component: Page1 },
  { key: 'page2', index: 1, component: Page2 },
  { key: 'page3', index: 2, component: Page3 },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [notificationsAlreadyGranted, setNotificationsAlreadyGranted] = useState(false);

  // Check if notifications are already granted on mount
  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotificationsAlreadyGranted(status === 'granted');
    });
  }, []);

  const handleComplete = useCallback(async () => {
    await markOnboardingComplete();
    router.replace('/');
  }, [router]);

  const goToPage = useCallback(
    (page: number) => {
      // Skip notification page (index 1) if already granted
      if (page === 1 && notificationsAlreadyGranted) {
        page = 2;
      }
      if (page >= PAGES.length) {
        handleComplete();
        return;
      }
      flatListRef.current?.scrollToIndex({ index: page, animated: true });
    },
    [handleComplete, notificationsAlreadyGranted]
  );

  const handleNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentPage(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<OnboardingPage>) => {
      const PageComponent = item.component;
      const pageNext = () => goToPage(item.index + 1);
      return (
        <View style={{ width: SCREEN_WIDTH }}>
          <PageComponent onNext={pageNext} />
        </View>
      );
    },
    [goToPage]
  );

  // Page 2 has its own action buttons, page 3 has its own
  // Only show Next button on page 1
  const showNextButton = currentPage === 0;

  return (
    <View style={styles.container} testID="onboardingScreen">
      <StatusBar style="light" />

      {/* Skip button */}
      <View style={styles.skipContainer}>
        <TouchableOpacity
          testID="onboardingSkipButton"
          onPress={handleSkip}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.pager}
      />

      {/* Bottom area: dots + next button */}
      <View style={styles.bottomArea}>
        <PageDots currentPage={currentPage} />
        {showNextButton && (
          <TouchableOpacity
            testID="onboardingNextButton"
            style={styles.primaryButton}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 50,
  },
  skipContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '500',
    color: '#8888A0',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  heroArea: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(168, 85, 246, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#A855F6',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(168, 85, 246, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 32,
  },
  pillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  pillar: {
    alignItems: 'center',
    gap: 6,
  },
  pillarLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8888A0',
  },
  pillarDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#1C1C2E',
  },
  textArea: {
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E8E8ED',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8888A0',
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsList: {
    marginTop: 24,
    gap: 16,
    width: '100%',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 16,
    color: '#4ADE80',
    fontWeight: '600',
  },
  benefitText: {
    fontSize: 14,
    color: '#E8E8ED',
  },
  actionArea: {
    marginTop: 24,
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#A855F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#8888A0',
    fontSize: 15,
    fontWeight: '500',
  },
  bottomArea: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 24,
    gap: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8888A0',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#A855F6',
  },
});
