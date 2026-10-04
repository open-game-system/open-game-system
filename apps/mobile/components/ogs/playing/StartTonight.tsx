import { useRouter } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { gameFacts, groupNote, type Pick, sharedLine } from "../../../services/playing-home";
import { Button } from "../Button";
import { artUrl } from "../GameArt";
import { artKit, shelfShape } from "../library/art-kit";
import { usePlay } from "../library/use-play";
import { colors, fonts } from "../theme";
import { ArtTitle } from "./ArtTitle";

/**
 * What to start: the first pick large with Play (the empty state), the rest as covers you can
 * swipe. A cover opens the game's page; Play starts it (asking to cast first when it must).
 */
export function StartTonight({
  title,
  picks,
  big,
  startPrimary = false,
}: {
  title: string;
  picks: Pick[];
  /** Lead with one large pick (the empty state); else every pick is a cover. */
  big: boolean;
  /** Play is the screen's one primary action (nothing else competes, e.g. once cast). */
  startPrimary?: boolean;
}) {
  const router = useRouter();
  if (!picks.length) return null;
  const [first, ...rest] = big ? picks : [null, ...picks];
  const covers = rest.filter((p): p is Pick => p !== null);
  const shape = shelfShape(covers.map((p) => p.game));
  // Said once above the row when every cover would repeat it.
  const sharedWhy = groupNote(sharedLine(covers.map((p) => p.why)));
  const openPage = (pick: Pick) =>
    router.push({ pathname: "/library/[appId]", params: { appId: pick.game.appId } });
  return (
    <View style={styles.wrap} testID="playingStart">
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {first ? (
        <BigPick pick={first} primary={startPrimary} onOpen={() => openPage(first)} />
      ) : null}
      {sharedWhy ? (
        <Text style={[styles.sharedWhy, first ? styles.sharedWhyAfterBig : null]}>
          {first ? `More games · ${sharedWhy}` : sharedWhy}
        </Text>
      ) : null}
      {covers.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          style={styles.rowScroll}
        >
          {covers.map((pick) => (
            <Pressable
              key={pick.game.appId}
              testID={`playingSuggestion-${pick.game.appId}`}
              accessibilityRole="button"
              accessibilityLabel={`${pick.game.name}, ${pick.why}`}
              onPress={() => openPage(pick)}
              style={({ pressed }) => [
                shape === "cover" ? styles.coverTile : styles.wideTile,
                pressed && styles.pressed,
              ]}
            >
              {shape === "cover" ? (
                <Image
                  source={{ uri: artUrl(artKit(pick.game).cover ?? pick.game.art.tile) }}
                  style={styles.cover}
                />
              ) : (
                <ArtTitle game={pick.game} width={220} radius={14} />
              )}
              {sharedWhy ? null : (
                <Text style={styles.why} numberOfLines={1}>
                  {pick.why}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function BigPick({ pick, primary, onOpen }: { pick: Pick; primary: boolean; onOpen: () => void }) {
  const { width } = useWindowDimensions();
  const play = usePlay(pick.game);
  return (
    <View style={styles.big}>
      <Pressable
        testID={`playingSuggestion-${pick.game.appId}`}
        accessibilityRole="button"
        accessibilityLabel={`${pick.game.name}, ${pick.why}. Open its page`}
        onPress={onOpen}
      >
        <ArtTitle game={pick.game} width={width - 40} aspect={2.1} />
      </Pressable>
      <View style={styles.bigBody}>
        <Text style={styles.tagline} numberOfLines={2}>
          {pick.game.tagline}
        </Text>
        <Text style={styles.why}>
          {[pick.why, gameFacts(pick.game)].filter(Boolean).join(" · ")}
        </Text>
        <Button
          testID="playingStartGame"
          label="Play"
          kind={primary ? "primary" : "ghost"}
          onPress={play.startNew}
          style={styles.startButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.cream, marginBottom: 12 },
  big: { borderRadius: 20, overflow: "hidden", backgroundColor: colors.dusk1 },
  bigBody: { padding: 16, paddingTop: 12, gap: 6 },
  tagline: { color: colors.cream2, fontSize: 16, lineHeight: 22 },
  why: { color: colors.cream3, fontSize: 14, fontWeight: "600", marginTop: 6 },
  pressed: { opacity: 0.85 },
  startButton: { marginTop: 10 },
  sharedWhy: { color: colors.cream3, fontSize: 14, fontWeight: "600", marginTop: -4 },
  sharedWhyAfterBig: { marginTop: 18 },
  rowScroll: { marginHorizontal: -20, marginTop: 14 },
  row: { paddingHorizontal: 20, gap: 12 },
  coverTile: { width: 132 },
  cover: { width: 132, height: 198, borderRadius: 14, backgroundColor: colors.dusk2 },
  wideTile: { width: 220 },
});
