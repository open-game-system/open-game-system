import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sticker } from "../Sticker";
import { colors, fonts, TARGET } from "../theme";
import type { ProfileCardView } from "./profile-view";

/** You: a big sticker, your name and "@id · Edit" (spec ogs-profiles, 2 · 03). */
export function ProfileCard({ me, onEdit }: { me: ProfileCardView | null; onEdit: () => void }) {
  return (
    <View style={styles.card} testID="profileCard">
      <View style={styles.halo} testID={`profileCardSticker-${me?.sticker ?? "bear"}`}>
        <Sticker id={me?.sticker ?? "bear"} size={112} />
      </View>
      {me ? (
        <>
          <Text style={styles.name} testID="profileName" numberOfLines={1}>
            {me.name}
          </Text>
          <Pressable
            testID="profileEdit"
            accessibilityRole="button"
            accessibilityLabel={`${me.handle}, edit profile`}
            onPress={onEdit}
            style={styles.handleRow}
          >
            <Text style={styles.handle} testID="profileHandle">
              {me.handle}
            </Text>
            <Text style={styles.edit}> · Edit</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.pending}>This device has no OGS profile yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", paddingTop: 4, paddingBottom: 8, gap: 8 },
  halo: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.dusk2,
    borderWidth: 1,
    borderColor: colors.hair,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, maxWidth: "90%" },
  handleRow: { flexDirection: "row", alignItems: "center", minHeight: TARGET },
  handle: { color: colors.cream2, fontSize: 17, fontWeight: "600" },
  edit: { color: colors.peach, fontSize: 17, fontWeight: "700" },
  pending: { color: colors.cream3, fontSize: 15, textAlign: "center", maxWidth: 280 },
});
