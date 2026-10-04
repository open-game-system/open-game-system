import type { Manifest } from "@open-game-system/ogs-protocol";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { safeCrop } from "../../../services/art-crop";
import { artUrl } from "../GameArt";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";
import type { Holder } from "./remote-view";
import type { TvMirror } from "./tv-mirror";

const ART_H = 204;
const ICON = 46;

/** The room art the TV fills with: the clean hero, else the capture cropped HUD-free. */
function RoomArt({ game }: { game: Manifest }) {
  const clean = game.art.heroClean;
  return (
    <Image
      source={{ uri: artUrl(clean ?? game.art.hero ?? game.art.tile) }}
      style={[StyleSheet.absoluteFill, clean ? null : safeCrop(game.art.safe)]}
      resizeMode="cover"
    />
  );
}

/** The game's logo at its own shape (left-aligned, like the TV's left third), else its name. */
function Logo({ game, title }: { game: Manifest | null; title: string }) {
  const [ratio, setRatio] = useState<number | null>(null);
  if (!game?.art.logo)
    return (
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    );
  return (
    <Image
      source={{ uri: artUrl(game.art.logo) }}
      accessibilityLabel={title}
      onLoad={(e) => {
        const { width, height } = e.nativeEvent.source;
        if (width > 0 && height > 0) setRatio(width / height);
      }}
      style={[styles.logo, { aspectRatio: ratio ?? 2 }]}
      resizeMode="contain"
    />
  );
}

/** A row of square game icons (Surprise me's pool, or the games on Home). */
function Icons({ games }: { games: Manifest[] }) {
  return (
    <View style={styles.icons}>
      {games.slice(0, 5).map((g) => (
        <View key={g.appId} style={styles.icon}>
          <Image
            source={{ uri: artUrl(g.art.icon ?? g.art.tile) }}
            style={[StyleSheet.absoluteFill, g.art.icon ? null : safeCrop(g.art.safe)]}
          />
        </View>
      ))}
    </View>
  );
}

function Face({ mirror, library }: { mirror: TvMirror; library: Manifest[] }) {
  const { game } = mirror;
  return (
    <View style={styles.face}>
      {game ? (
        <RoomArt game={game} />
      ) : (
        <LinearGradient
          colors={[colors.dusk3, colors.dusk1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* The TV keeps its left third quiet for the logo; so does the phone. */}
      <LinearGradient
        colors={["rgba(18, 15, 34, 0.82)", "rgba(18, 15, 34, 0.35)", "rgba(18, 15, 34, 0)"]}
        locations={[0, 0.5, 0.85]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(18, 15, 34, 0)", "rgba(18, 15, 34, 0.78)"]}
        start={{ x: 0.5, y: 0.45 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.faceText}>
        <Text style={styles.kicker}>ON THE TV</Text>
        {mirror.kind === "surprise" ? (
          <>
            <Icons games={mirror.kids} />
            <Text style={styles.title}>Surprise me</Text>
          </>
        ) : mirror.kind === "home" && !game ? (
          <>
            <Icons games={library} />
            <Text style={styles.title}>Home</Text>
          </>
        ) : (
          <Logo game={game} title={mirror.title} />
        )}
        {mirror.chip || mirror.resume ? (
          <View style={styles.chipRow}>
            {mirror.chip ? (
              <View style={[styles.chip, mirror.kind === "game" && styles.chipLive]}>
                <Text style={styles.chipText}>{mirror.chip}</Text>
              </View>
            ) : null}
            {mirror.resume ? (
              <Text style={styles.resume} numberOfLines={1}>
                {mirror.resume}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.spacer} />
        <Text style={styles.action} numberOfLines={1} testID="remoteNowAction">
          {mirror.action}
        </Text>
      </View>
    </View>
  );
}

/**
 * What the TV shows right now, mirrored: the focused game's art, logo and paused chip, and what OK
 * does. Under it, which TV (tap to change it, for the caster), or whose TV and Leave (for a phone
 * that joined).
 */
export function NowOnTv({
  mirror,
  library,
  tvName,
  changeTv,
  onChangeTv,
  rowEnd,
}: {
  mirror: TvMirror;
  library: Manifest[];
  tvName: string;
  changeTv: boolean;
  onChangeTv: () => void;
  rowEnd?: ReactNode;
}) {
  const said = [mirror.title, mirror.chip, mirror.resume, mirror.action].filter(Boolean).join(". ");
  const device = (
    <>
      <View style={styles.live}>
        <View style={styles.liveDot} />
      </View>
      <Text style={styles.deviceName} numberOfLines={1} testID="remoteTvName">
        {tvName}
      </Text>
    </>
  );
  return (
    <View style={styles.card} testID="remoteNowOn">
      <View accessible accessibilityLabel={`On the TV: ${said}`}>
        <Face mirror={mirror} library={library} />
      </View>
      {changeTv ? (
        <Pressable
          testID="tvPickerOpen"
          accessibilityRole="button"
          accessibilityLabel={`Casting to ${tvName}. Change TV`}
          onPress={onChangeTv}
          style={({ pressed }) => [styles.device, pressed && styles.devicePressed]}
        >
          {device}
          <Text style={styles.change}>Change</Text>
          <SymbolView
            name="chevron.up.chevron.down"
            size={14}
            weight="semibold"
            tintColor={colors.cream3}
            style={styles.chev}
          />
        </Pressable>
      ) : (
        <View style={styles.device}>
          {device}
          {rowEnd}
        </View>
      )}
    </View>
  );
}

/** Who holds the remote: their sticker and name, said plainly (nothing when nobody does). */
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
      <View style={[styles.holderSticker, holder.kind === "me" && styles.holderStickerMe]}>
        {sticker ? (
          <Sticker id={sticker} size={34} />
        ) : (
          <SymbolView
            name="iphone"
            size={16}
            weight="semibold"
            tintColor={colors.cream2}
            style={styles.phone}
          />
        )}
      </View>
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
  face: { height: ART_H, backgroundColor: colors.dusk2 },
  faceText: { flex: 1, padding: 16, paddingBottom: 12, gap: 8, alignItems: "flex-start" },
  kicker: {
    color: colors.cream2,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    opacity: 0.85,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.cream, maxWidth: 220 },
  logo: { height: 58, maxWidth: 190 },
  icons: { flexDirection: "row", gap: 8 },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.dusk2,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: {
    backgroundColor: colors.cream,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipLive: { backgroundColor: colors.lamp },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  resume: { color: colors.cream, fontSize: 14, fontWeight: "700" },
  spacer: { flex: 1 },
  action: { color: colors.cream, fontSize: 15, fontWeight: "700" },
  device: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
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
  change: { color: colors.cream2, fontSize: 15, fontWeight: "600" },
  chev: { width: 14, height: 14 },
  holder: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  holderSticker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.dusk2,
    alignItems: "center",
    justifyContent: "center",
  },
  holderStickerMe: { borderWidth: 2, borderColor: colors.lamp },
  phone: { width: 16, height: 16 },
  holderText: { color: colors.cream, fontSize: 17, fontWeight: "700" },
});
