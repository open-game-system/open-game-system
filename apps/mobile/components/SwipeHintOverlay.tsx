import { memo, useCallback, useEffect, useState } from "react";
import { Animated, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
import { shouldShowSwipeHint } from "../services/session-counter";

interface SwipeHintOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export const SwipeHintOverlay = memo(function SwipeHintOverlay({
  visible,
  onDismiss,
}: SwipeHintOverlayProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (shouldRender) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShouldRender(false));
    }
  }, [visible, opacity, shouldRender]);

  if (!shouldRender) return null;

  return (
    <TouchableWithoutFeedback onPress={onDismiss} testID="swipeHintOverlay">
      <Animated.View style={[styles.container, { opacity }]}>
        <View style={styles.content}>
          <Text style={styles.arrow}>←</Text>
          <View style={styles.textGroup}>
            <Text style={styles.title}>Swipe to go home</Text>
            <Text style={styles.subtitle}>Tap anywhere to dismiss</Text>
          </View>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
});

/**
 * Hook to manage swipe hint visibility.
 * Returns [showHint, dismissHint] — checks session counter on mount.
 */
export function useSwipeHint(): [boolean, () => void] {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    shouldShowSwipeHint().then((show) => {
      if (show) setShowHint(true);
    });
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
  }, []);

  return [showHint, dismissHint];
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 200,
    justifyContent: "center",
    paddingLeft: 20,
  },
  content: {
    flexDirection: "column",
    gap: 12,
  },
  arrow: {
    fontSize: 24,
    color: "#A855F6",
    fontWeight: "600",
  },
  textGroup: {
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
  },
});
