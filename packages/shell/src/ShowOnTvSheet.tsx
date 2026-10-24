import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { AirplaySheet, AirplaySheetMode, AirplaySheetState } from "./airplay-sheet";

/** The sheet's colours; the default is the OGS dusk palette. */
export interface ShowOnTvTheme {
  sheet: string;
  text: string;
  muted: string;
  accent: string;
  /** Text on the accent. */
  onAccent: string;
  panel: string;
}

export const DEFAULT_SHOW_ON_TV_THEME: ShowOnTvTheme = {
  sheet: "#1b1733",
  text: "#fbf2e4",
  muted: "#bdb2c9",
  accent: "#ffc861",
  onAccent: "#1b1733",
  panel: "#272148",
};

/**
 * How to show the game on an Apple TV. iOS doesn't let an app start Screen Mirroring, and the
 * AirPlay picker only sends sound, so this shows the Control Center steps and waits: the cast
 * closes it when the TV's display connects. "audio-only": the user picked the AirPlay sound route.
 * The content alone, for a sheet that is already open (the OGS app's cast prompt).
 */
export function AirplaySteps({
  mode,
  onClose,
  theme = DEFAULT_SHOW_ON_TV_THEME,
}: {
  mode: AirplaySheetMode;
  onClose: () => void;
  theme?: ShowOnTvTheme;
}) {
  const t = theme;
  return (
    <View testID="airplaySteps">
      {mode === "audio-only" ? (
        <View testID="audioOnlyNotice">
          <Text style={[styles.title, { color: t.text }]}>That sent sound only.</Text>
          <Text style={[styles.lead, { color: t.text }]}>
            Use Screen Mirroring for the picture.
          </Text>
        </View>
      ) : (
        <View>
          <Text style={[styles.title, { color: t.text }]}>Show the game on your TV</Text>
          <Text style={[styles.lead, { color: t.text }]}>
            Open Control Center, tap Screen Mirroring, and choose your Apple TV.
          </Text>
        </View>
      )}
      <Illustration theme={t} />
      <View style={styles.steps}>
        <Step n={1} theme={t} text="Swipe down from the top-right corner to open Control Center." />
        <Step n={2} theme={t} text="Tap Screen Mirroring (the two-rectangle icon)." />
        <Step
          n={3}
          theme={t}
          text="Choose your Apple TV. The game appears on the TV; your controls stay on this phone."
        />
      </View>
      <View
        style={[styles.waiting, { backgroundColor: t.panel }]}
        testID="waitingForTv"
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color={t.accent} />
        <Text style={[styles.waitingText, { color: t.text }]}>Waiting for your TV…</Text>
      </View>
      <Pressable
        testID="closeShowOnTv"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.secondary}
      >
        <Text style={[styles.secondaryText, { color: t.muted }]}>Not now</Text>
      </Pressable>
    </View>
  );
}

/** The steps in a bottom sheet of their own. */
export function ShowOnTvSheet({
  state,
  onClose,
  theme = DEFAULT_SHOW_ON_TV_THEME,
}: {
  state: AirplaySheetState;
  onClose: () => void;
  theme?: ShowOnTvTheme;
}) {
  return (
    <Modal visible={state.open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: theme.sheet }]} testID="showOnTvSheet">
        <AirplaySteps mode={state.mode} onClose={onClose} theme={theme} />
      </View>
    </Modal>
  );
}

/** How long a just-opened sheet waits before it shows: a picker's sheet may still be closing. */
export const SETTLE_MS = 350;

/**
 * The sheet bound to its store. `hidden`: another sheet shows the steps right now (the OGS app's
 * cast prompt renders AirplaySteps itself, since iOS can't present two sheets side by side).
 */
export function AirplaySheetHost({
  sheet,
  hidden = false,
  theme,
}: {
  sheet: AirplaySheet;
  hidden?: boolean;
  theme?: ShowOnTvTheme;
}) {
  const state = useSyncExternalStore(sheet.subscribe, sheet.get, sheet.get);
  const [settled, setSettled] = useState(false);
  // A timer while the sheet is open (a legitimate effect): show it once the screen has settled.
  useEffect(() => {
    if (!state.open) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [state.open]);
  return (
    <ShowOnTvSheet
      state={{ open: state.open && settled && !hidden, mode: state.mode }}
      onClose={() => sheet.close()}
      {...(theme ? { theme } : {})}
    />
  );
}

/** A phone with Control Center open (Screen Mirroring lit) and the TV it goes to. Views only. */
function Illustration({ theme }: { theme: ShowOnTvTheme }) {
  return (
    <View
      style={ill.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[ill.phone, { borderColor: theme.muted }]}>
        <View style={[ill.swipe, { backgroundColor: theme.text }]} />
        <View style={ill.grid}>
          <View style={ill.tile} />
          <View style={ill.tile} />
          <View style={[ill.tile, { backgroundColor: theme.accent }]}>
            <MirrorIcon color={theme.onAccent} fill={theme.accent} size={22} />
          </View>
          <View style={ill.tile} />
          <View style={[ill.tile, ill.wide]} />
        </View>
      </View>
      <View style={ill.arrow}>
        <View style={[ill.arrowLine, { backgroundColor: theme.accent }]} />
        <View style={[ill.arrowHead, { borderLeftColor: theme.accent }]} />
      </View>
      <View style={ill.tvWrap}>
        <View style={[ill.tv, { borderColor: theme.muted }]}>
          <View style={[ill.screen, { backgroundColor: theme.panel }]} />
        </View>
        <View style={[ill.stand, { backgroundColor: theme.muted }]} />
      </View>
    </View>
  );
}

/** The Screen Mirroring glyph: two overlapping rectangles. */
function MirrorIcon({ color, fill, size }: { color: string; fill: string; size: number }) {
  const w = size * 0.72;
  const h = size * 0.52;
  const box = {
    position: "absolute" as const,
    width: w,
    height: h,
    borderWidth: 2,
    borderColor: color,
    borderRadius: 3,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[box, { left: 0, top: 0 }]} />
      <View style={[box, { right: 0, bottom: size * 0.12, backgroundColor: fill }]} />
    </View>
  );
}

function Step({ n, text, theme }: { n: number; text: string; theme: ShowOnTvTheme }) {
  return (
    <View style={styles.step}>
      <View style={[styles.badge, { backgroundColor: theme.accent }]}>
        <Text style={[styles.badgeText, { color: theme.onAccent }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const ill = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    gap: 14,
  },
  phone: {
    width: 92,
    height: 150,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: "#120f22",
    padding: 8,
    paddingTop: 14,
  },
  swipe: { position: "absolute", top: 4, right: 10, width: 22, height: 3, borderRadius: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tile: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  wide: { width: 70 },
  arrow: { flexDirection: "row", alignItems: "center" },
  arrowLine: { width: 26, height: 3 },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 12,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  tvWrap: { alignItems: "center" },
  tv: {
    width: 132,
    height: 80,
    borderRadius: 8,
    borderWidth: 4,
    backgroundColor: "#120f22",
    padding: 4,
  },
  screen: { flex: 1, borderRadius: 3 },
  stand: { width: 40, height: 6, borderRadius: 3, marginTop: 4 },
});

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(10, 8, 20, 0.6)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 40,
  },
  title: { fontSize: 26, fontWeight: "700" },
  lead: { fontSize: 18, lineHeight: 24, marginTop: 6 },
  steps: { marginTop: 18, gap: 12 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 17, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 17, lineHeight: 24 },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  waitingText: { fontSize: 18, fontWeight: "600" },
  secondary: { alignItems: "center", paddingVertical: 14, marginTop: 4, minHeight: 48 },
  secondaryText: { fontSize: 18 },
});
