import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RemoteButton } from "../../services/remote";
import { colors, TARGET } from "./theme";

const ARROWS: Record<"up" | "down" | "left" | "right", string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};
const IDS: Record<RemoteButton, string> = {
  up: "remoteUp",
  down: "remoteDown",
  left: "remoteLeft",
  right: "remoteRight",
  ok: "remoteOk",
  back: "remoteBack",
  home: "remoteHome",
  end: "remoteEnd",
};
const LABELS: Record<RemoteButton, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  ok: "OK",
  back: "Back",
  home: "Home",
  end: "End for tonight",
};

function Key({
  button,
  onPress,
  style,
}: {
  button: RemoteButton;
  onPress: (b: RemoteButton) => void;
  style?: object;
}) {
  const arrow = button in ARROWS ? ARROWS[button as keyof typeof ARROWS] : null;
  return (
    <Pressable
      testID={IDS[button]}
      accessibilityRole="button"
      accessibilityLabel={LABELS[button]}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress(button);
      }}
      style={({ pressed }) => [styles.key, style, pressed && styles.pressed]}
    >
      <Text style={button === "ok" ? styles.okText : styles.keyText}>
        {arrow ?? LABELS[button]}
      </Text>
    </Pressable>
  );
}

/** The TV tab once cast: a d-pad for the launcher's focus ring, OK, Back, Home. */
export function RemotePad({ onPress }: { onPress: (b: RemoteButton) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.pad}>
        <Key button="up" onPress={onPress} style={styles.up} />
        <View style={styles.middle}>
          <Key button="left" onPress={onPress} />
          <Key button="ok" onPress={onPress} style={styles.ok} />
          <Key button="right" onPress={onPress} />
        </View>
        <Key button="down" onPress={onPress} style={styles.up} />
      </View>
      <View style={styles.row}>
        <Key button="back" onPress={onPress} style={styles.wide} />
        <Key button="home" onPress={onPress} style={styles.wide} />
      </View>
    </View>
  );
}

export function EndForTonight({ onPress }: { onPress: (b: RemoteButton) => void }) {
  return <Key button="end" onPress={onPress} style={styles.end} />;
}

const KEY = 72;
const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 22 },
  pad: {
    width: KEY * 3 + 36,
    height: KEY * 3 + 36,
    borderRadius: (KEY * 3 + 36) / 2,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  middle: { flexDirection: "row", alignItems: "center", gap: 6 },
  up: {},
  key: {
    minWidth: KEY,
    minHeight: KEY,
    borderRadius: KEY / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.dusk3 },
  keyText: { color: colors.cream, fontSize: 22, fontWeight: "700" },
  ok: { backgroundColor: colors.peach },
  okText: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", gap: 14 },
  wide: {
    minWidth: 120,
    minHeight: TARGET + 8,
    borderRadius: 26,
    backgroundColor: colors.dusk2,
    paddingHorizontal: 18,
  },
  end: {
    minHeight: TARGET + 8,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.hair,
    paddingHorizontal: 22,
    alignSelf: "center",
  },
});
