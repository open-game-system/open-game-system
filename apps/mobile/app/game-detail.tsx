import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { findGameById } from "../services/game-directory";
import { addRecentGame } from "../services/game-history";

export default function GameDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = id ? findGameById(id) : undefined;

  if (!game) {
    return (
      <View style={styles.container} testID="gameDetailScreen">
        <Text style={styles.errorText}>Game not found</Text>
      </View>
    );
  }

  const handlePlay = async () => {
    // Record in game history before navigating — ensures the write completes
    await addRecentGame(game.url, game.name);
    router.push({
      pathname: "/game",
      params: { url: game.url, name: game.name },
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container} testID="gameDetailScreen">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back nav */}
        <TouchableOpacity
          testID="gameDetailBackButton"
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: game.iconBgColor }]}>
          <Text style={[styles.heroInitials, { color: game.iconColor, opacity: 0.25 }]}>
            {game.iconInitials}
          </Text>
        </View>

        {/* Game Info */}
        <View style={styles.info}>
          <Text style={styles.gameName}>{game.name}</Text>
          <Text style={styles.gameOrigin}>by {new URL(game.url).hostname}</Text>
        </View>

        {/* Tags */}
        <View style={styles.tags}>
          {game.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.description}>{game.description}</Text>

        {/* OGS Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresLabel}>OGS Features</Text>
          <View style={styles.featuresRow}>
            {game.features.includes("push") && (
              <View style={styles.featureBox}>
                <Text style={styles.featureIcon}>★</Text>
                <Text style={styles.featureText}>Push Alerts</Text>
              </View>
            )}
            {game.features.includes("cast") && (
              <View style={styles.featureBox}>
                <Text style={styles.featureIcon}>▣</Text>
                <Text style={styles.featureText}>TV Cast</Text>
              </View>
            )}
            {game.features.includes("activity") && (
              <View style={styles.featureBox}>
                <Text style={styles.featureIcon}>◷</Text>
                <Text style={styles.featureText}>Activity</Text>
              </View>
            )}
          </View>
        </View>

        {/* Play Button */}
        <TouchableOpacity
          testID="gameDetailPlayButton"
          style={styles.playButton}
          onPress={handlePlay}
        >
          <Text style={styles.playButtonText}>Play {game.name}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 50,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#A855F6",
  },
  hero: {
    height: 180,
    marginHorizontal: 24,
    marginTop: 4,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  heroInitials: {
    fontSize: 56,
    fontWeight: "700",
  },
  info: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 8,
  },
  gameName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#E8E8ED",
    letterSpacing: -0.5,
  },
  gameOrigin: {
    fontSize: 14,
    color: "#8888A0",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#1C1C2E",
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8888A0",
  },
  description: {
    fontSize: 15,
    color: "#E8E8ED",
    lineHeight: 23,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  featuresSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  featuresLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8888A0",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  featuresRow: {
    flexDirection: "row",
    gap: 12,
  },
  featureBox: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: "#141420",
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 20,
    color: "#A855F6",
  },
  featureText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#E8E8ED",
  },
  playButton: {
    backgroundColor: "#A855F6",
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 24,
    marginTop: 28,
    alignItems: "center",
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 16,
    textAlign: "center",
    marginTop: 100,
  },
});
