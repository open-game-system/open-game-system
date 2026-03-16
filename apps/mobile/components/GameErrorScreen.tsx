import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GameErrorScreenProps {
  originDomain: string;
  onRetry: () => void;
  onGoHome: () => void;
}

export const GameErrorScreen = memo(function GameErrorScreen({
  originDomain,
  onRetry,
  onGoHome,
}: GameErrorScreenProps) {
  return (
    <View style={styles.container} testID="gameErrorScreen">
      <View style={styles.icon}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.title}>Couldn't load game</Text>
      <Text style={styles.message}>
        {originDomain} isn't responding. Check your connection and try again.
      </Text>
      <TouchableOpacity
        testID="gameRetryButton"
        style={styles.retryButton}
        onPress={onRetry}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="gameGoHomeButton"
        style={styles.goHomeButton}
        onPress={onGoHome}
      >
        <Text style={styles.goHomeText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#DC2626',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E8E8ED',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: '#8888A0',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#A855F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  goHomeButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  goHomeText: {
    color: '#8888A0',
    fontSize: 15,
    fontWeight: '500',
  },
});
