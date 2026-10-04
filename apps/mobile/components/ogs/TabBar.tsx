import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { SymbolView } from "expo-symbols";
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
import { profileView } from "./profile/profile-view";
import { Sticker } from "./Sticker";
import { tabAccessibilityLabel, tabItem } from "./tab-items";
import { colors, fonts, TARGET } from "./theme";

const ICON = 24;

/**
 * Playing · TV · Library · Friends · Profile (always all five): a small icon over each label
 * (Profile is your sticker), with the return pill and the remote offer above.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { pill, identity } = useApp();
  const { remoteOffer } = useCouch();
  const cast = useOgsCast();
  const { badge } = usePlaying();
  const sticker = profileView(identity)?.sticker ?? "bear";

  return (
    // Icons and labels sit wholly above the home indicator; with no indicator (SE), a small margin.
    <View
      testID="tabBarWrap"
      style={[styles.wrap, { paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 10 }]}
    >
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
          accessibilityLabel={`Rejoin ${pill.name}`}
          style={styles.pill}
          onPress={() => openPill(pill)}
        >
          <View style={styles.pillDot} />
          <Text style={styles.pillName} numberOfLines={1}>
            {pill.name}
          </Text>
          <Text style={styles.pillAction}>Rejoin</Text>
        </Pressable>
      ) : null}
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = tabItem(route.name);
          if (!meta) return null;
          const focused = state.index === index;
          const tint = focused ? colors.lamp : colors.cream3;
          return (
            <Pressable
              key={route.key}
              testID={meta.testID}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tabAccessibilityLabel(meta, { badge, cast })}
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
              <View style={styles.icon}>
                {meta.symbol ? (
                  <SymbolView
                    name={focused ? meta.symbol.on : meta.symbol.idle}
                    size={ICON}
                    tintColor={tint}
                    style={styles.symbol}
                  />
                ) : (
                  <View style={[styles.me, focused && styles.meOn]}>
                    <Sticker id={sticker} size={ICON} />
                  </View>
                )}
                {meta.route === "playing" && badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
                {meta.route === "tv" && cast ? (
                  <View style={styles.live} testID="tvLiveDot" />
                ) : null}
              </View>
              <Text
                testID={`${meta.testID}Label`}
                style={[styles.label, focused && styles.labelOn]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {meta.label}
              </Text>
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
  // Side padding keeps the outer tabs clear of the screen's rounded corners.
  bar: { flexDirection: "row", paddingHorizontal: 10 },
  tab: { flex: 1, minHeight: TARGET + 6, alignItems: "center", justifyContent: "center", gap: 3 },
  icon: { width: 34, height: ICON + 4, alignItems: "center", justifyContent: "center" },
  symbol: { width: ICON + 4, height: ICON },
  me: {
    width: ICON + 4,
    height: ICON + 4,
    borderRadius: (ICON + 4) / 2,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.75,
  },
  meOn: { opacity: 1, borderWidth: 2, borderColor: colors.lamp },
  label: { fontSize: 12, fontWeight: "700", color: colors.cream3, letterSpacing: 0.1 },
  labelOn: { color: colors.lamp },
  underline: { marginTop: 1, height: 3, width: 20, borderRadius: 2 },
  underlineOn: { backgroundColor: colors.lamp },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: colors.lamp,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.dusk0,
  },
  badgeText: { color: colors.ink, fontWeight: "800", fontSize: 11 },
  live: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ember,
    borderWidth: 2,
    borderColor: colors.dusk0,
  },
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
