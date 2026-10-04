import type { Friend } from "@open-game-system/ogs-protocol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../Button";
import { Sticker } from "../Sticker";
import { colors, TARGET } from "../theme";
import { subtitleOf } from "./friends-view";

/** A friend: sticker, name, "@id · presence"; Join while they cast. Long press to remove. */
export function FriendRow({
  friend,
  onJoin,
  onLongPress,
}: {
  friend: Friend;
  onJoin: (() => void) | null;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      testID={`friend-${friend.handle}`}
      accessibilityLabel={`${friend.name}, ${subtitleOf(friend)}`}
      onLongPress={onLongPress}
      style={styles.row}
    >
      <Sticker id={friend.sticker} size={48} seed={friend.id} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {friend.name}
        </Text>
        <Text
          style={[styles.sub, friend.presence.kind === "casting" && styles.live]}
          numberOfLines={1}
          testID={`friendPresence-${friend.handle}`}
        >
          {subtitleOf(friend)}
        </Text>
      </View>
      {onJoin ? (
        <Button label="Join" testID={`friendJoin-${friend.handle}`} onPress={onJoin} />
      ) : null}
    </Pressable>
  );
}

export const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: TARGET + 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hair,
  },
  text: { flex: 1, gap: 2 },
  name: { color: colors.cream, fontSize: 18, fontWeight: "700" },
  sub: { color: colors.cream3, fontSize: 15 },
  live: { color: colors.lamp, fontWeight: "700" },
});
const styles = rowStyles;
