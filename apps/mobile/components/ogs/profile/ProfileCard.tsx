import { StyleSheet, Text, View } from "react-native";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";
import type { Me } from "./profile-view";

/**
 * You: a big sticker and your name. No @handle and no Edit yet: both need the profiles backend
 * (POST /profiles, PATCH /me), so neither is shown until it exists.
 */
export function ProfileCard({ me }: { me: Me | null }) {
  return (
    <View style={styles.card} testID="profileCard">
      <View style={styles.halo}>
        <Sticker id={me?.sticker ?? "bear"} size={112} />
      </View>
      {me ? (
        <Text style={styles.name} testID="profileName" numberOfLines={1}>
          {me.name}
        </Text>
      ) : (
        <Text style={styles.pending}>Your profile is being set up. Check back in a moment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", paddingTop: 4, paddingBottom: 8, gap: 14 },
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
  pending: { color: colors.cream3, fontSize: 15, textAlign: "center", maxWidth: 280 },
});
