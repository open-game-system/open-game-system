import { Component, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors } from "./theme";

/**
 * The app's last line against a render error: report it once (`onError`, the client log's
 * `app.render_error`) and show a calm screen with Try again instead of a crash. Boundaries don't
 * see event handlers or async code; the global handler (services/js-errors.ts) does.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View testID="appError" style={styles.screen}>
        <Text style={styles.title}>Something went wrong</Text>
        <Button
          testID="appError.retry"
          label="Try again"
          onPress={() => this.setState({ failed: false })}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 24,
    backgroundColor: colors.dusk0,
  },
  title: { color: colors.cream, fontSize: 22, fontFamily: "Fraunces-Display" },
});
