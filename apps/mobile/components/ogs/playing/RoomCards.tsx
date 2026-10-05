import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFriendRooms } from "../../../services/friends-runtime";
import { roomJoiner } from "../../../services/runtime";
import { Button } from "../Button";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";

/**
 * Several couches, one room (spec §7): "Jonathan and Sam are playing Night Flight", Join with
 * your couch. Starts the game in that room on this couch's TV (cast first if it isn't). Renders
 * nothing when no friend's TV is in a room.
 */
export function RoomCards() {
  const router = useRouter();
  const cards = useFriendRooms();
  const [castFirst, setCastFirst] = useState<string | null>(null);
  if (cards.length === 0) return null;
  const join = (appId: string, room: string, key: string) => {
    const outcome = roomJoiner.join(appId, room);
    if (outcome === "cast-first") {
      setCastFirst(key);
      router.navigate("/tv");
    }
  };
  return (
    <View style={styles.list} testID="roomCards">
      {cards.map((c) => (
        <View key={c.key} style={styles.card} testID={`roomCard-${c.room}`}>
          <View style={styles.stickers}>
            {c.hosts.slice(0, 3).map((h, i) => (
              <View key={h.id} style={i > 0 ? styles.overlap : null}>
                <Sticker id={h.sticker} size={44} seed={h.id} />
              </View>
            ))}
          </View>
          <Text style={styles.title}>{c.title}</Text>
          {castFirst === c.key ? (
            <Text style={styles.detail}>Cast to your TV and the game starts there.</Text>
          ) : null}
          <Button
            label="Join with your couch"
            testID={`roomJoin-${c.room}`}
            onPress={() => join(c.appId, c.room, c.key)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginBottom: 18 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.dusk2,
    borderWidth: 1,
    borderColor: colors.lamp,
  },
  stickers: { flexDirection: "row" },
  overlap: { marginLeft: -12 },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.cream },
  detail: { color: colors.cream2, fontSize: 15 },
});
