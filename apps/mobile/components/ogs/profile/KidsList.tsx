import { StyleSheet, Text, View } from "react-native";
import { SectionTitle } from "../Screen";
import { Sticker } from "../Sticker";
import { colors } from "../theme";
import type { Kid } from "./profile-view";

/** Kids are managed profiles under you (profiles proposal, Q2): sticker, name, band. */
export function KidsList({ kids }: { kids: Kid[] }) {
  if (kids.length === 0) return null;
  return (
    <View testID="profileKids">
      <SectionTitle>Kids on this phone</SectionTitle>
      <View style={styles.list}>
        {kids.map((kid, i) => (
          <View
            key={kid.personId}
            style={[styles.row, i < kids.length - 1 && styles.divider]}
            testID={`profileKid-${kid.personId}`}
          >
            <Sticker id={kid.sticker} size={48} seed={kid.personId} />
            <Text style={styles.name} numberOfLines={1}>
              {kid.name}
            </Text>
            <Text style={styles.band}>{kid.bandLabel}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 18,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hair },
  name: { flex: 1, color: colors.cream, fontSize: 18, fontWeight: "700" },
  band: { color: colors.cream3, fontSize: 14, fontWeight: "600" },
});
