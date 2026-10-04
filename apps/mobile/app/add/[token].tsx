import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Button } from "../../components/ogs/Button";
import { ErrorLine } from "../../components/ogs/ErrorLine";
import { Screen } from "../../components/ogs/Screen";
import { colors } from "../../components/ogs/theme";
import { friendsStore } from "../../services/friends-runtime";
import { useApp } from "../../services/runtime";
import type { ErrorAction } from "../../services/user-message";

/**
 * An invite opened in OGS: opengame://add/<token>, from a scanned QR (friends at once) or a shared
 * link (a request they accept). Redeems once when shown, then offers Friends.
 */
export default function InviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const hasProfile = useApp().identity !== null;
  const [state, setState] = useState<
    | { kind: "working" }
    | { kind: "done"; text: string }
    | { kind: "error"; text: string; action: ErrorAction }
  >({ kind: "working" });

  const redeem = useCallback(async () => {
    if (!hasProfile) {
      setState({ kind: "error", text: "Make your OGS profile first.", action: "make-profile" });
      return;
    }
    const r = await friendsStore.addByLink(`opengame://add/${token ?? ""}`);
    if (!r.ok) setState({ kind: "error", text: r.message, action: r.action });
    else
      setState({
        kind: "done",
        text:
          r.outcome === "friends"
            ? `You and ${r.name} are friends.`
            : `Sent. ${r.name} will see your request in Friends.`,
      });
  }, [hasProfile, token]);
  useFocusEffect(
    useCallback(() => {
      void redeem();
    }, [redeem]),
  );

  return (
    <Screen title="Add a friend" testID="inviteScreen">
      <Stack.Screen options={{ presentation: "modal" }} />
      {state.kind === "working" ? <Text style={styles.text}>Adding…</Text> : null}
      {state.kind === "done" ? (
        <Text style={styles.good} testID="inviteDone">
          {state.text}
        </Text>
      ) : null}
      {state.kind === "error" ? (
        <ErrorLine
          text={state.text}
          action={state.action}
          onRetry={() => void redeem()}
          testID="inviteFailed"
        />
      ) : null}
      <Button
        label="Friends"
        testID="inviteToFriends"
        onPress={() => router.replace("/friends")}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.cream2, fontSize: 17, textAlign: "center" },
  good: { color: colors.mint, fontSize: 18, textAlign: "center" },
  button: { marginTop: 24 },
});
