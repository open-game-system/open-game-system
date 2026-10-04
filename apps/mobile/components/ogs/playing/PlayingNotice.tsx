import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { UserMessage } from "../../../services/user-message";
import { Button } from "../Button";
import { ErrorLine } from "../ErrorLine";
import { colors, fonts } from "../theme";

/** Loading, your games didn't load, or no games: calm, specific, one way forward. */
export function PlayingNotice({
  kind,
  error,
  onRetry,
  onLibrary,
}: {
  kind: "loading" | "offline" | "noGames";
  error?: UserMessage | null;
  onRetry: () => void;
  onLibrary: () => void;
}) {
  if (kind === "loading")
    return (
      <View style={styles.loading} testID="playingLoading">
        <ActivityIndicator color={colors.cream3} />
      </View>
    );
  if (kind === "offline")
    return (
      <View style={styles.box} testID="playingOffline">
        <Text style={styles.title}>Your games didn't load</Text>
        {!error || error.action === "retry" ? (
          // The usual case: one calm line and a full-size Try again.
          <>
            <Text style={styles.body} testID="playingError">
              {error?.text ?? "Can't reach OGS. Check your Wi-Fi and try again."}
            </Text>
            <Button
              testID="playingRetry"
              label="Try again"
              onPress={onRetry}
              style={styles.button}
            />
          </>
        ) : (
          <ErrorLine
            text={error.text}
            action={error.action}
            onRetry={onRetry}
            testID="playingError"
          />
        )}
      </View>
    );
  return (
    <View style={styles.box} testID="playingNoGames">
      <Text style={styles.title}>No games yet</Text>
      <Text style={styles.body}>
        Add a game to your library and it shows up here, ready to start.
      </Text>
      <Button
        testID="playingAddGames"
        label="Add games"
        onPress={onLibrary}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 80, alignItems: "center" },
  // Low on the page, in thumb reach, rather than a line under the title and an empty screen.
  box: { paddingTop: 160, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  body: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  button: { marginTop: 8 },
});
