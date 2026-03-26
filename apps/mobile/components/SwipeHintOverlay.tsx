import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { shouldShowSwipeHint } from "../services/session-counter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SwipeHintOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export const SwipeHintOverlay = memo(function SwipeHintOverlay({
  visible,
  onDismiss,
}: SwipeHintOverlayProps) {
  const [animOpacity] = useState(() => new Animated.Value(0));
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (shouldRender) {
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShouldRender(false));
    }
  }, [visible, animOpacity, shouldRender]);

  if (!shouldRender) return null;

  return (
    <Animated.View style={[styles.fullScreen, { opacity: animOpacity }]}>
      <Pressable style={styles.fullScreen} onPress={onDismiss} testID="swipeHintOverlay">
        <LinearGradient
          colors={["rgba(10, 10, 15, 0.92)", "rgba(10, 10, 15, 0.5)", "transparent"]}
          locations={[0, 0.45, 0.7]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />

        <View style={styles.edgeGlow} />

        <View style={styles.content}>
          <Text style={styles.arrow}>←</Text>
          <Text style={styles.title}>Swipe to go home</Text>
          <Text style={styles.subtitle}>Tap anywhere to dismiss</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

let hintShownThisSession = false;

export function useSwipeHint(): [boolean, () => void] {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (hintShownThisSession) return;
    shouldShowSwipeHint().then((show) => {
      if (show && !hintShownThisSession) {
        hintShownThisSession = true;
        setShowHint(true);
      }
    });
  }, []);

  const dismissHint = useCallback(() => {
    setShowHint(false);
  }, []);

  return [showHint, dismissHint];
}

const styles = StyleSheet.create({
  fullScreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
  },
  edgeGlow: {
    position: "absolute",
    left: 0,
    bottom: 130,
    width: 4,
    height: 56,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: "#A855F6",
    opacity: 0.8,
  },
  content: {
    position: "absolute",
    left: 0,
    bottom: 120,
    width: SCREEN_WIDTH * 0.5,
    paddingLeft: 28,
    gap: 10,
  },
  arrow: {
    fontSize: 28,
    color: "#A855F6",
    fontWeight: "600",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
  },
});
