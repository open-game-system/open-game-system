import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  couchHub,
  openPill,
  useApp,
  useCouch,
  useOgsCast,
  usePlaying,
} from "../../services/runtime";
import { colors, fonts, TARGET } from "./theme";

const LABELS: Record<string, { label: string; testID: string }> = {
  playing: { label: "Playing", testID: "tabPlaying" },
  tv: { label: "TV", testID: "tabTV" },
  library: { label: "Library", testID: "tabLibrary" },
};

/** Playing · TV · Library (always all three), with the return pill and the remote offer above. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { pill } = useApp();
  const { remoteOffer } = useCouch();
  const cast = useOgsCast();
  const { badge } = usePlaying();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {remoteOffer ? (
        <View style={styles.offer} testID="remoteOffer">
          <Text style={styles.offerText}>The remote phone went quiet.</Text>
          <Pressable
            style={styles.offerButton}
            accessibilityRole="button"
            testID="takeRemote"
            onPress={() => couchHub.takeRemote()}
          >
            <Text style={styles.offerButtonText}>Take the remote</Text>
          </Pressable>
          <Pressable
            style={styles.offerLater}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => couchHub.dismissRemoteOffer()}
          >
            <Text style={styles.offerLaterText}>Not now</Text>
          </Pressable>
        </View>
      ) : null}
      {pill ? (
        <Pressable
          testID="returnPill"
          accessibilityRole="button"
          accessibilityLabel={`Back in to ${pill.name}`}
          style={styles.pill}
          onPress={() => openPill(pill)}
        >
          <View style={styles.pillDot} />
          <Text style={styles.pillName} numberOfLines={1}>
            {pill.name}
          </Text>
          <Text style={styles.pillAction}>Back in</Text>
        </Pressable>
      ) : null}
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = LABELS[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              testID={meta.testID}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={
                route.name === "playing" && badge
                  ? `Playing, ${badge} your turn`
                  : route.name === "tv" && cast
                    ? "TV, cast"
                    : meta.label
              }
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            >
              <View style={styles.labelRow}>
                <Text style={[styles.label, focused && styles.labelOn]}>{meta.label}</Text>
                {route.name === "playing" && badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
                {route.name === "tv" && cast ? (
                  <View style={styles.live} testID="tvLiveDot" />
                ) : null}
              </View>
              <View style={[styles.underline, focused && styles.underlineOn]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.dusk0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hair,
    paddingTop: 8,
  },
  bar: { flexDirection: "row" },
  tab: { flex: 1, minHeight: TARGET + 6, alignItems: "center", justifyContent: "center" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 16, fontWeight: "700", color: colors.cream3 },
  labelOn: { color: colors.lamp },
  underline: { marginTop: 6, height: 3, width: 26, borderRadius: 2 },
  underlineOn: { backgroundColor: colors.lamp },
  badge: {
    backgroundColor: colors.lamp,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.ink, fontWeight: "800", fontSize: 12 },
  live: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.ember },
  pill: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: TARGET,
    borderRadius: 22,
    backgroundColor: colors.dusk2,
    borderWidth: 1,
    borderColor: colors.hair,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember },
  pillName: { flex: 1, color: colors.cream, fontFamily: fonts.display, fontSize: 17 },
  pillAction: { color: colors.peach, fontWeight: "800", fontSize: 15 },
  offer: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: colors.dusk2,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  offerText: { color: colors.cream2, fontSize: 15, flexBasis: "100%" },
  offerButton: {
    minHeight: TARGET,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.peach,
    justifyContent: "center",
  },
  offerButtonText: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  offerLater: { minHeight: TARGET, paddingHorizontal: 12, justifyContent: "center" },
  offerLaterText: { color: colors.cream3, fontSize: 15, fontWeight: "600" },
});
