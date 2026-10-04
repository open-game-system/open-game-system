import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GameArt } from "../GameArt";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";
import { type Holder, nowLine, type OnTv } from "./remote-view";

/** What the TV shows right now, and which TV it is (tap to change TV). */
export function NowOnTv({
  onTv,
  tvName,
  onChangeTv,
}: {
  onTv: OnTv;
  tvName: string;
  onChangeTv: () => void;
}) {
  const detail = nowLine(onTv);
  return (
    <View style={styles.card} testID="remoteNowOn">
      <View style={styles.top}>
        {onTv.kind !== "home" && onTv.game ? (
          <GameArt game={onTv.game} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.homeArt]}>
            <SymbolView
              name="house.fill"
              size={26}
              tintColor={colors.lamp}
              style={styles.homeSymbol}
            />
          </View>
        )}
        <View style={styles.text}>
          <Text style={styles.kicker}>ON THE TV</Text>
          <Text style={styles.name} numberOfLines={1}>
            {onTv.kind === "home" ? "Home" : onTv.name}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </View>
      <Pressable
        testID="tvPickerOpen"
        accessibilityRole="button"
        accessibilityLabel={`Casting to ${tvName}. Change TV`}
        onPress={onChangeTv}
        style={({ pressed }) => [styles.device, pressed && styles.devicePressed]}
      >
        <View style={styles.live}>
          <View style={styles.liveDot} />
        </View>
        <Text style={styles.deviceName} numberOfLines={1}>
          {tvName}
        </Text>
        <Text style={styles.change}>Change</Text>
        <SymbolView
          name="chevron.up.chevron.down"
          size={14}
          weight="semibold"
          tintColor={colors.cream3}
          style={styles.chev}
        />
      </Pressable>
    </View>
  );
}

/** Who holds the remote: a sticker and a short line (nothing when nobody does). */
export function HolderLine({ holder }: { holder: Holder }) {
  if (holder.kind === "nobody") return null;
  const sticker = holder.kind === "me" || holder.kind === "person" ? holder.sticker : null;
  const line =
    holder.kind === "me"
      ? "You have the remote"
      : holder.kind === "person"
        ? `${holder.name} has the remote`
        : "Another phone has the remote";
  return (
    <View style={styles.holder} testID="remoteHolder">
      {sticker ? <Sticker id={sticker} size={26} /> : null}
      <Text style={styles.holderText}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dusk1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hair,
    overflow: "hidden",
  },
  top: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  art: { width: 112, height: 63, borderRadius: 12 },
  homeArt: {
    backgroundColor: colors.dusk2,
    alignItems: "center",
    justifyContent: "center",
  },
  homeSymbol: { width: 26, height: 26 },
  text: { flex: 1, gap: 2 },
  kicker: { color: colors.cream3, fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.cream },
  detail: { color: colors.cream2, fontSize: 15 },
  device: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hair,
  },
  devicePressed: { backgroundColor: colors.dusk2 },
  live: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.emberGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ember },
  deviceName: { flex: 1, color: colors.cream, fontSize: 16, fontWeight: "700" },
  change: { color: colors.cream3, fontSize: 15, fontWeight: "600" },
  chev: { width: 14, height: 14 },
  holder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 30,
  },
  holderText: { color: colors.cream3, fontSize: 14, fontWeight: "600" },
});
