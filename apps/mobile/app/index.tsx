import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import {
  getRecentGames,
  type GameHistoryEntry,
} from '../services/game-history';
import {
  consumePendingGameUrl,
  subscribeToGameUrl,
} from '../services/game-url-store';
import {
  GAME_DIRECTORY,
  findGameByUrl,
  type GameDirectoryEntry,
} from '../services/game-directory';

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const [recentGames, setRecentGames] = useState<GameHistoryEntry[]>([]);

  const loadRecentGames = useCallback(async () => {
    const games = await getRecentGames();
    setRecentGames(games);
  }, []);

  const navigation = useNavigation();

  // Reload games whenever home screen becomes focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecentGames();
    });
    return unsubscribe;
  }, [navigation, loadRecentGames]);

  // Handle pending game URLs from deep links (cold start)
  useEffect(() => {
    const pending = consumePendingGameUrl();
    if (pending) {
      router.push({ pathname: '/game', params: { url: pending } });
      return;
    }

    const unsubscribe = subscribeToGameUrl((gameUrl) => {
      router.push({ pathname: '/game', params: { url: gameUrl } });
    });

    return unsubscribe;
  }, [router]);

  const openGameDetail = (gameId: string) => {
    router.push({ pathname: '/game-detail', params: { id: gameId } });
  };

  const openContinueGame = (entry: GameHistoryEntry) => {
    router.push({
      pathname: '/game',
      params: { url: entry.url, name: entry.name },
    });
    setTimeout(loadRecentGames, 500);
  };

  const openSettings = () => {
    router.push('/settings');
  };

  const hasContinueGames = recentGames.length > 0;

  return (
    <View style={styles.container} testID="homeScreen">
      <StatusBar style="light" />
      <ScrollView
        testID="homeScrollView"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft} testID="headerLogo">
            <View style={styles.ogsIcon}>
              <Text style={styles.ogsIconText}>OGS</Text>
            </View>
            {hasContinueGames ? (
              <Text style={styles.headerTitle}>Your Games</Text>
            ) : null}
          </View>
          <TouchableOpacity
            testID="hamburgerMenu"
            style={styles.menuButton}
            onPress={openSettings}
          >
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>

        {/* Empty State / Welcome */}
        {!hasContinueGames && (
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome to OGS</Text>
            <Text style={styles.welcomeBody}>
              Play web games with native superpowers. Pick a game below to get
              started.
            </Text>
          </View>
        )}

        {/* Continue Section */}
        {hasContinueGames && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Continue</Text>
            {recentGames.map((game) => {
              const directoryEntry = findGameByUrl(game.url);
              return (
                <TouchableOpacity
                  key={game.url}
                  testID={`continueGame-${directoryEntry?.id ?? 'unknown'}`}
                  style={styles.continueRow}
                  onPress={() => openContinueGame(game)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dotIndicator,
                      {
                        backgroundColor:
                          directoryEntry?.iconColor ?? '#A855F6',
                      },
                    ]}
                  />
                  <View style={styles.continueInfo}>
                    <Text style={styles.continueName}>{game.name}</Text>
                    <Text style={styles.continueTime}>
                      {formatRelativeTime(game.lastPlayed)}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Game Directory */}
        <View style={styles.section}>
          <Text
            style={
              hasContinueGames
                ? styles.discoverTitle
                : styles.sectionLabel
            }
          >
            {hasContinueGames ? 'Discover' : 'Game Directory'}
          </Text>
          {GAME_DIRECTORY.map((game) => (
            <DirectoryRow
              key={game.id}
              game={game}
              onPress={() => openGameDetail(game.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function DirectoryRow({
  game,
  onPress,
}: {
  game: GameDirectoryEntry;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`directoryGame-${game.id}`}
      style={styles.directoryRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.directoryIcon, { backgroundColor: game.iconBgColor }]}
      >
        <Text style={[styles.directoryIconText, { color: game.iconColor }]}>
          {game.iconInitials}
        </Text>
      </View>
      <View style={styles.directoryInfo}>
        <Text style={styles.directoryName}>{game.name}</Text>
        <Text style={styles.directoryDescription}>{game.description}</Text>
      </View>
      <TouchableOpacity
        testID={`directoryPlayButton-${game.id}`}
        style={styles.playButton}
        onPress={onPress}
      >
        <Text style={styles.playButtonText}>Play</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  headerLeft: {
    gap: 4,
  },
  ogsIcon: {
    marginBottom: 4,
  },
  ogsIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A855F6',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#E8E8ED',
    letterSpacing: -1.5,
  },
  menuButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  menuLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#8888A0',
  },
  welcomeSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E8E8ED',
    letterSpacing: -0.5,
  },
  welcomeBody: {
    fontSize: 15,
    color: '#8888A0',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8888A0',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  discoverTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#E8E8ED',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C2E',
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  continueInfo: {
    flex: 1,
    paddingLeft: 16,
    gap: 2,
  },
  continueName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8E8ED',
    letterSpacing: -0.3,
  },
  continueTime: {
    fontSize: 13,
    color: '#8888A0',
  },
  chevron: {
    fontSize: 22,
    color: '#8888A0',
    fontWeight: '300',
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C2E',
    gap: 16,
  },
  directoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directoryIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  directoryInfo: {
    flex: 1,
    gap: 4,
  },
  directoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E8E8ED',
    letterSpacing: -0.2,
  },
  directoryDescription: {
    fontSize: 14,
    color: '#8888A0',
    lineHeight: 20,
  },
  playButton: {
    backgroundColor: '#A855F6',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
