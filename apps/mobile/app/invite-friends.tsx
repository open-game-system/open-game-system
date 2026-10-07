import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/ogs/Button";
import { ErrorLine } from "../components/ogs/ErrorLine";
import { rowStyles } from "../components/ogs/friends/FriendRow";
import { Screen } from "../components/ogs/Screen";
import { Sticker } from "../components/ogs/Sticker";
import { colors } from "../components/ogs/theme";
import { friendsApi, useFriends } from "../services/friends-runtime";
import { invitedLine } from "../services/rooms";
import { userMessage } from "../services/user-message";

/**
 * Invite friends to this game (spec §7): pick friends, Send. Each gets a push and the link
 * opengame.org/play/<appId>?room=<room>, which starts the game in this room on their own TV.
 */
export default function InviteFriendsScreen() {
  const router = useRouter();
  const { appId, room, name } = useLocalSearchParams<{
    appId: string;
    room: string;
    name?: string;
  }>();
  const { friends } = useFriends();
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ line: string; link: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const send = async () => {
    if (!appId || !room || picked.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const result = await friendsApi.inviteToGame(appId, room, picked);
      const names = result.invited.map(
        (i) => friends.find((f) => f.id === i.profileId)?.name ?? "a friend",
      );
      setDone({ line: invitedLine(names), link: result.link });
    } catch (err) {
      setError(userMessage(err, "friends").text);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      title="Invite friends"
      testID="inviteFriendsScreen"
      footer={
        done ? (
          <View style={styles.footer}>
            <Button
              label="Share the link"
              kind="ghost"
              testID="inviteShare"
              onPress={() => void Share.share({ message: done.link })}
            />
            <Button label="Done" testID="inviteDoneButton" onPress={() => router.back()} />
          </View>
        ) : (
          <Button
            label={sending ? "Sending…" : "Send invites"}
            disabled={sending || picked.length === 0}
            testID="inviteSend"
            onPress={() => void send()}
          />
        )
      }
    >
      <Text style={styles.lead}>
        {`They play ${name ?? "this game"} on their own TV, in room ${room ?? ""}.`}
      </Text>
      {done ? (
        <Text style={styles.done} testID="inviteDone">
          {done.line}
        </Text>
      ) : (
        friends.map((f) => {
          const on = picked.includes(f.id);
          return (
            <Pressable
              key={f.id}
              testID={`inviteFriend-${f.handle}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={f.name}
              onPress={() => toggle(f.id)}
              style={rowStyles.row}
            >
              <Sticker id={f.sticker} size={48} seed={f.id} />
              <View style={rowStyles.text}>
                <Text style={rowStyles.name}>{f.name}</Text>
                <Text style={rowStyles.sub}>@{f.handle}</Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Text style={styles.tick}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })
      )}
      {friends.length === 0 && !done ? (
        <Text style={styles.lead}>Add friends in the Friends tab first.</Text>
      ) : null}
      <ErrorLine text={error} testID="inviteError" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.cream2, fontSize: 17, lineHeight: 24, marginBottom: 12 },
  done: { color: colors.cream, fontSize: 22, fontWeight: "700", marginTop: 8 },
  footer: { gap: 10 },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.cream3,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.lamp, borderColor: colors.lamp },
  tick: { color: colors.ink, fontSize: 18, fontWeight: "800" },
});
