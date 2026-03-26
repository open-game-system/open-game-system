import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface GameLoadingOverlayProps {
  gameName: string;
  originDomain: string;
  iconInitials: string;
  iconColor: string;
  iconBgColor: string;
}

export const GameLoadingOverlay = memo(function GameLoadingOverlay({
  gameName,
  originDomain,
  iconInitials,
  iconColor,
  iconBgColor,
}: GameLoadingOverlayProps) {
  return (
    <View style={styles.container} testID="gameLoadingScreen">
      <View style={[styles.icon, { backgroundColor: iconBgColor }]}>
        <Text style={[styles.iconText, { color: iconColor }]}>{iconInitials}</Text>
      </View>
      <Text style={styles.title}>Loading {gameName}</Text>
      <Text style={styles.domain}>{originDomain}</Text>
      <ActivityIndicator color="#A855F6" style={styles.spinner} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A0F",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  iconText: {
    fontSize: 28,
    fontWeight: "700",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#E8E8ED",
    letterSpacing: -0.3,
  },
  domain: {
    fontSize: 14,
    color: "#8888A0",
  },
  spinner: {
    marginTop: 16,
  },
});
