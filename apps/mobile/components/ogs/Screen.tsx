import { StatusBar } from "expo-status-bar";
import { type ReactNode, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardFooterScroll } from "./KeyboardFooter";
import { colors, fonts } from "./theme";

/**
 * A tab's page: dusk background, a Fraunces title, scrolling content. A `footer` (a form's main
 * action) stays on screen at the bottom, above the keyboard while it is up.
 */
export function Screen({
  title,
  right,
  children,
  footer,
  testID,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  // A footer screen fills its modal sheet (or the display): the footer needs the sheet's height.
  const [height, setHeight] = useState<number | undefined>(undefined);
  const header = (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
  if (footer)
    return (
      <View
        style={styles.root}
        testID={testID}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      >
        <StatusBar style="light" />
        <KeyboardFooterScroll
          sheetHeight={height}
          contentContainerStyle={[styles.formContent, { paddingTop: insets.top + 12 }]}
          footerStyle={styles.footer}
          restingBottom={insets.bottom}
          footer={footer}
        >
          {header}
          {children}
        </KeyboardFooterScroll>
      </View>
    );
  return (
    <View style={styles.root} testID={testID}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        // A tap on a button with the keyboard up presses it (not just closes the keyboard).
        keyboardShouldPersistTaps="handled"
        // A screen with a text field: the keyboard insets the page and scrolls the field above it.
        automaticallyAdjustKeyboardInsets
      >
        {header}
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
  formContent: { paddingHorizontal: 20, paddingBottom: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 },
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
