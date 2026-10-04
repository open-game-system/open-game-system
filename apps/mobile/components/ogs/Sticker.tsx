import { Image, type ImageSourcePropType, StyleSheet, View } from "react-native";

const SOURCES: Record<string, ImageSourcePropType> = {
  bear: require("../../assets/stickers/bear.webp"),
  owl: require("../../assets/stickers/owl.webp"),
  dragon: require("../../assets/stickers/dragon.webp"),
  dinosaur: require("../../assets/stickers/dinosaur.webp"),
  turtle: require("../../assets/stickers/turtle.webp"),
  whale: require("../../assets/stickers/whale.webp"),
  firefly: require("../../assets/stickers/firefly.webp"),
  mouse: require("../../assets/stickers/mouse.webp"),
  cloud: require("../../assets/stickers/cloud.webp"),
};

/** A small, stable tilt per id, so a row of stickers looks stuck on by hand. */
function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 11) - 5;
}

/** A person's painted Story Nook character (never initials). */
export function Sticker({ id, size = 40, seed }: { id: string; size?: number; seed?: string }) {
  const source = SOURCES[id] ?? SOURCES.bear;
  return (
    <View
      style={{ width: size, height: size, transform: [{ rotate: `${tiltOf(seed ?? id)}deg` }] }}
    >
      <Image source={source} style={styles.img} resizeMode="contain" />
    </View>
  );
}

export function StickerRow({ ids, size = 30 }: { ids: string[]; size?: number }) {
  return (
    <View style={styles.row}>
      {ids.map((id, i) => (
        <View key={`${id}-${i}`} style={{ marginLeft: i === 0 ? 0 : -size * 0.25 }}>
          <Sticker id={id} size={size} seed={`${id}${i}`} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: "100%" },
  row: { flexDirection: "row", alignItems: "center" },
});
