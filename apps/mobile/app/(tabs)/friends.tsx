import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ogs/Button";
import { ErrorLine } from "../../components/ogs/ErrorLine";
import { FriendRow } from "../../components/ogs/friends/FriendRow";
import { FriendsEmpty } from "../../components/ogs/friends/FriendsEmpty";
import { RequestRow } from "../../components/ogs/friends/RequestRow";
import { Screen, SectionTitle } from "../../components/ogs/Screen";
import { colors } from "../../components/ogs/theme";
import { friendsStore, useFriends } from "../../services/friends-runtime";
import { useApp } from "../../services/runtime";
import type { ErrorAction } from "../../services/user-message";

/** Friends tab: requests on top, then friends with presence (a casting friend shows Join), Add a friend. */
export default function FriendsScreen() {
  const router = useRouter();
  const app = useApp();
  const data = useFriends();
  const [error, setError] = useState<{ text: string; action: ErrorAction } | null>(null);
  const add = app.identity ? () => router.push("/add-friend") : null;

  const run = async (
    action: Promise<{ ok: true } | { ok: false; message: string; action: ErrorAction }>,
  ) => {
    setError(null);
    const result = await action;
    if (!result.ok) setError({ text: result.message, action: result.action });
  };
  /** Join a friend's cast, then the TV tab (the remote for that couch). */
  const join = async (sessionId: string) => {
    setError(null);
    const result = await friendsStore.joinCast(sessionId);
    if (result.ok) router.navigate("/tv");
    else setError({ text: result.message, action: result.action });
  };
  const mySession = app.session?.sessionId ?? null;
  const remove = (id: string, name: string) =>
    Alert.alert(`Remove ${name}?`, "You won't see each other in Friends.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void run(friendsStore.remove(id)) },
    ]);

  const nothing =
    data.friends.length === 0 && data.incoming.length === 0 && data.outgoing.length === 0;
  const shown = error ?? data.error;
  return (
    <Screen title="Friends" testID="friendsScreen">
      <ErrorLine
        text={shown?.text ?? null}
        action={shown?.action}
        onRetry={() => void friendsStore.refresh()}
        testID="friendsError"
      />
      {nothing ? (
        <FriendsEmpty onAdd={add} />
      ) : (
        <>
          {data.incoming.length > 0 ? (
            <View testID="friendRequests">
              <SectionTitle count={data.incoming.length}>Requests</SectionTitle>
              {data.incoming.map((r) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  incoming
                  onAccept={() => void run(friendsStore.accept(r.id))}
                  onDecline={() => void run(friendsStore.decline(r.id))}
                />
              ))}
            </View>
          ) : null}
          <View testID="friendList">
            <SectionTitle>Friends</SectionTitle>
            {data.friends.length === 0 ? (
              <Text style={styles.none}>No friends yet. Accept a request or add someone.</Text>
            ) : null}
            {data.friends.map((f) => {
              const live =
                f.presence.kind === "casting" && f.presence.sessionId !== mySession
                  ? f.presence.sessionId
                  : null;
              return (
                <FriendRow
                  key={f.id}
                  friend={f}
                  onJoin={live ? () => void join(live) : null}
                  onLongPress={() => remove(f.id, f.name)}
                />
              );
            })}
          </View>
          {data.outgoing.length > 0 ? (
            <View testID="friendRequestsSent">
              <SectionTitle>Sent</SectionTitle>
              {data.outgoing.map((r) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  incoming={false}
                  onAccept={() => {}}
                  onDecline={() => void run(friendsStore.decline(r.id))}
                />
              ))}
            </View>
          ) : null}
          {add ? (
            <Button label="Add a friend" testID="addFriend" onPress={add} style={styles.add} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: { marginTop: 24 },
  none: { color: colors.cream3, fontSize: 15 },
});
