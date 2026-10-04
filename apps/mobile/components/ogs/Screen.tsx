import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "./theme";

/** A tab's page: dusk background, a Fraunces title, scrolling content. */
export function Screen({
  title,
  right,
  children,
  testID,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root} testID={testID}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

export function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {count ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  content: { paddingHorizontal: 20, paddingBottom: 140 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
    minHeight: 44,
  },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.cream },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
    marginBottom: 10,
  },
  section: { fontFamily: fonts.display, fontSize: 22, color: colors.cream },
  count: {
    backgroundColor: colors.lamp,
    borderRadius: 12,
    minWidth: 28,
    paddingHorizontal: 8,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: colors.ink, fontWeight: "800", fontSize: 14 },
});
