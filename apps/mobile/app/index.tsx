import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import {
  getRecentGames,
  type GameHistoryEntry,
} from "../services/game-history";
import {
  consumePendingGameUrl,
  subscribeToGameUrl,
} from "../services/game-url-store";

const FEATURED_GAMES = [
  {
    url: "https://triviajam.tv",
    name: "Trivia Jam",
    description: "Real-time multiplayer trivia with friends",
    featured: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [recentGames, setRecentGames] = useState<GameHistoryEntry[]>([]);
  const [sandboxUrl, setSandboxUrl] = useState("");

  // Load recent games on mount and when screen focuses
  const loadRecentGames = useCallback(async () => {
    const games = await getRecentGames();
    setRecentGames(games);
  }, []);

  useEffect(() => {
    loadRecentGames();
  }, [loadRecentGames]);

  // Handle pending game URLs from deep links (cold start)
  useEffect(() => {
    const pending = consumePendingGameUrl();
    if (pending) {
      router.push({ pathname: "/game", params: { url: pending } });
      return;
    }

    // Subscribe to future game URL changes (warm start deep links, notification taps)
    const unsubscribe = subscribeToGameUrl((gameUrl) => {
      router.push({ pathname: "/game", params: { url: gameUrl } });
    });

    return unsubscribe;
  }, [router]);

  const launchGame = (url: string, name: string) => {
    router.push({ pathname: "/game", params: { url, name } });
    // Reload recent games when we come back
    setTimeout(loadRecentGames, 500);
  };

  const launchSandbox = () => {
    const url = sandboxUrl.trim();
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    launchGame(fullUrl, "Sandbox");
    setSandboxUrl("");
  };

  return (
    <View style={styles.container} testID="homeScreen">
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.headerSection} testID="headerLogo">
          <Text style={styles.logo}>OGS</Text>
          <Text style={styles.subtitle}>Open Game System</Text>
        </View>

        {/* Featured Games */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Games</Text>
          {FEATURED_GAMES.map((game) => (
            <TouchableOpacity
              key={game.url}
              style={styles.featuredCard}
              onPress={() => launchGame(game.url, game.name)}
              activeOpacity={0.8}
            >
              <View style={styles.featuredContent}>
                <Text style={styles.featuredName}>{game.name}</Text>
                <Text style={styles.featuredDescription}>
                  {game.description}
                </Text>
                <View style={styles.playButton}>
                  <Text style={styles.playButtonText}>Play</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Your Games (Recently Played) */}
        {recentGames.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Games</Text>
            {recentGames.map((game) => (
              <TouchableOpacity
                key={game.url}
                style={styles.gameRow}
                onPress={() => launchGame(game.url, game.name)}
                activeOpacity={0.7}
              >
                <View style={styles.gameRowInfo}>
                  <Text style={styles.gameRowName}>{game.name}</Text>
                  <Text style={styles.gameRowUrl} numberOfLines={1}>
                    {game.url}
                  </Text>
                </View>
                <View style={styles.playButtonSmall}>
                  <Text style={styles.playButtonSmallText}>Play</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sandbox */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sandbox</Text>
          <Text style={styles.sandboxHint}>
            Enter a URL to load any game with bridge access
          </Text>
          <View style={styles.sandboxRow}>
            <TextInput
              style={styles.sandboxInput}
              value={sandboxUrl}
              onChangeText={setSandboxUrl}
              placeholder="https://your-game.com"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={launchSandbox}
            />
            <TouchableOpacity
              style={[
                styles.sandboxButton,
                !sandboxUrl.trim() && styles.sandboxButtonDisabled,
              ]}
              onPress={launchSandbox}
              disabled={!sandboxUrl.trim()}
            >
              <Text style={styles.sandboxButtonText}>Go</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Push Notifications</Text>
            <Text style={styles.settingsValue}>Enabled</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Cast Devices</Text>
            <Text style={styles.settingsValue}>Auto-discover</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: "#a855f6",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  featuredCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#a855f6",
  },
  featuredContent: {
    padding: 20,
  },
  featuredName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  featuredDescription: {
    fontSize: 15,
    color: "#aaa",
    marginBottom: 16,
  },
  playButton: {
    backgroundColor: "#a855f6",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "flex-start",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  gameRowInfo: {
    flex: 1,
    marginRight: 12,
  },
  gameRowName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  gameRowUrl: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  playButtonSmall: {
    backgroundColor: "#a855f6",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  playButtonSmallText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sandboxHint: {
    fontSize: 13,
    color: "#888",
    marginBottom: 12,
  },
  sandboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sandboxInput: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#333",
    marginRight: 8,
  },
  sandboxButton: {
    backgroundColor: "#a855f6",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  sandboxButtonDisabled: {
    opacity: 0.4,
  },
  sandboxButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingsLabel: {
    fontSize: 15,
    color: "#fff",
  },
  settingsValue: {
    fontSize: 14,
    color: "#888",
  },
});
