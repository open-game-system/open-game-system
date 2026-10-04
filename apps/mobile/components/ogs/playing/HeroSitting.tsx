import type { Manifest } from "@open-game-system/ogs-protocol";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { openGame } from "../../../services/runtime";
import type { Sitting } from "../../../services/sittings";
import { Button } from "../Button";
import { usePlay } from "../library/use-play";
import { colors } from "../theme";
import { ArtTitle } from "./ArtTitle";
import { StatusTag } from "./StatusTag";

/**
 * The sitting Playing leads with: the game live on the TV (`sitting` null), else your turn or the
 * one you played last. Its key art and logo, the resume point as the headline, one Rejoin (a TV
 * game while not cast casts first).
 */
export function HeroSitting({
  game,
  sitting,
  tag,
  live,
  headline,
  meta,
  testID,
  buttonTestID,
}: {
  game: Manifest;
  sitting: Sitting | null;
  tag: string;
  live: boolean;
  headline: string;
  meta: string | null;
  testID: string;
  buttonTestID: string;
}) {
  const { width } = useWindowDimensions();
  const play = usePlay(game);
  return (
    <View style={styles.card} testID={testID}>
      <ArtTitle game={game} width={width - 40}>
        <StatusTag label={tag} live={live} />
      </ArtTitle>
      <View style={styles.body}>
        <Text style={styles.headline} numberOfLines={2}>
          {headline}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <Button
          testID={buttonTestID}
          label={play.busy ? "Casting…" : "Rejoin"}
          disabled={play.busy}
          onPress={() => (sitting ? play.rejoin(sitting) : openGame(game))}
          style={styles.button}
        />
        {play.note ? <Text style={styles.note}>{play.note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
  },
  body: { padding: 18, paddingTop: 14, gap: 4 },
  headline: { color: colors.cream, fontSize: 22, fontWeight: "700" },
  meta: { color: colors.cream3, fontSize: 15 },
  button: { marginTop: 12 },
  note: { color: colors.peach, fontSize: 14, marginTop: 6 },
});
