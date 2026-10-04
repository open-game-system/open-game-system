import { StyleSheet, Text, View } from "react-native";
import { Button } from "../Button";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";

/** Three Story Nook characters gathered together (whale behind): friends, before you have any. */
function Gathering() {
  return (
    <View style={styles.gathering} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.spot, { left: 78, top: 0 }]}>
        <Sticker id="whale" size={112} seed="friends-whale" />
      </View>
      <View style={[styles.spot, { left: 0, top: 34 }]}>
        <Sticker id="owl" size={92} seed="friends-owl" />
      </View>
      <View style={[styles.spot, { left: 186, top: 40 }]}>
        <Sticker id="firefly" size={84} seed="friends-firefly" />
      </View>
    </View>
  );
}

/** No friends yet: what friends do, and Add a friend (QR, code, link or @id). */
export function FriendsEmpty({ onAdd }: { onAdd: (() => void) | null }) {
  return (
    <View style={styles.root} testID="friendsEmpty">
      <Gathering />
      <Text style={styles.heading}>Play with friends</Text>
      <Text style={styles.body}>Friends can join each other's TV and see what you're playing.</Text>
      {onAdd ? (
        <Button label="Add a friend" testID="addFriend" onPress={onAdd} style={styles.share} />
      ) : (
        <Text style={styles.wait}>Your profile is being set up. Check back in a moment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", paddingTop: 48, gap: 14 },
  gathering: { width: 270, height: 140, marginBottom: 10 },
  spot: { position: "absolute" },
  heading: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, textAlign: "center" },
  body: {
    color: colors.cream2,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 300,
  },
  share: { marginTop: 12, alignSelf: "stretch" },
  wait: { color: colors.cream3, fontSize: 15, textAlign: "center", marginTop: 12 },
});
