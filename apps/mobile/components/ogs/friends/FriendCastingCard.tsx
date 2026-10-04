import type { CastingFriend } from "@open-game-system/ogs-protocol";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { friendsStore, useFriendCasts } from "../../../services/friends-runtime";
import type { ErrorAction } from "../../../services/user-message";
import { Button } from "../Button";
import { ErrorLine } from "../ErrorLine";
import { Sticker } from "../Sticker";
import { colors, fonts } from "../theme";
import { castCardLines } from "./friends-view";

/** One friend's live cast: "Mom is casting on Living room TV" with Join (spec: Join card on Playing). */
export function FriendCastingCard({
  card,
  onJoin,
  busy = false,
}: {
  card: CastingFriend;
  onJoin: () => void;
  busy?: boolean;
}) {
  const { title, detail } = castCardLines(card);
  return (
    <View style={styles.card} testID={`castCard-${card.host.handle}`}>
      <Sticker id={card.host.sticker} size={56} seed={card.host.id} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Button
        label={busy ? "Joining…" : "Join"}
        disabled={busy}
        testID={`castCardJoin-${card.host.handle}`}
        onPress={onJoin}
      />
    </View>
  );
}

/**
 * The Join cards for the top of Playing: every friend's live cast this device is not on. Joining
 * puts this device on that couch (no code) and opens the TV tab. Renders nothing when no friend
 * is casting.
 */
export function FriendCastingCards() {
  const router = useRouter();
  const cards = useFriendCasts();
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; action: ErrorAction } | null>(null);
  if (cards.length === 0) return null;
  const join = async (sessionId: string) => {
    setJoining(sessionId);
    setError(null);
    const result = await friendsStore.joinCast(sessionId);
    setJoining(null);
    if (result.ok) router.navigate("/tv");
    else setError({ text: result.message, action: result.action });
  };
  return (
    <View style={styles.list} testID="friendCastingCards">
      {cards.map((c) => (
        <FriendCastingCard
          key={c.sessionId}
          card={c}
          busy={joining === c.sessionId}
          onJoin={() => void join(c.sessionId)}
        />
      ))}
      <ErrorLine text={error?.text ?? null} action={error?.action} testID="castCardError" />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginBottom: 18 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: colors.dusk2,
    borderWidth: 1,
    borderColor: colors.lamp,
  },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.cream },
  detail: { color: colors.cream2, fontSize: 15 },
});
