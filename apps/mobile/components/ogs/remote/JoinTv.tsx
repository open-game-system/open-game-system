import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { CouchSessionInfo } from "../../../services/app-state";
import { appState } from "../../../services/runtime";
import type { ErrorAction } from "../../../services/user-message";
import { Button } from "../Button";
import { ErrorLine } from "../ErrorLine";
import { colors, fonts, TARGET } from "../theme";

/**
 * Join a TV someone else is casting, with the code the TV shows (a kid's iPad gets on the couch).
 * Once joined: which TV, whose games, and Leave.
 */
export function JoinTv({ joined }: { joined: CouchSessionInfo | null }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; action: ErrorAction } | null>(null);

  if (joined?.role === "member")
    return (
      <View style={styles.box} testID="joinedTv">
        <Text style={styles.title}>On the couch</Text>
        <Text style={styles.body} testID="joinedTvName">
          {joined.tvName} · {joined.host.name}'s games
        </Text>
        <Button
          label="Leave"
          kind="ghost"
          testID="leaveTv"
          onPress={() => void appState.leaveSession()}
        />
      </View>
    );

  const join = async () => {
    setBusy(true);
    setError(null);
    const result = await appState.joinSession(code);
    setBusy(false);
    if (result.ok) setCode("");
    else setError({ text: result.message, action: result.action });
  };

  return (
    <View style={styles.box} testID="joinTv">
      <Text style={styles.title}>Join a TV</Text>
      <Text style={styles.body}>Someone else casting? Type the code on the TV.</Text>
      <View style={styles.row}>
        <TextInput
          testID="joinTvCode"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          style={styles.input}
          placeholder="TV code"
          placeholderTextColor={colors.cream3}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          accessibilityLabel="TV code"
        />
        <Button
          label="Join"
          testID="joinTvButton"
          disabled={busy || code.trim().length < 4}
          onPress={() => void join()}
        />
      </View>
      <ErrorLine
        text={error?.text ?? null}
        action={error?.action}
        onRetry={() => void join()}
        testID="joinTvError"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 36, gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.cream },
  body: { color: colors.cream2, fontSize: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: TARGET + 4,
    borderRadius: 12,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    color: colors.cream,
    paddingHorizontal: 12,
    fontSize: 20,
    letterSpacing: 4,
  },
});
