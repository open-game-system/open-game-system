import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ErrorAction } from "../../services/user-message";
import { colors, TARGET } from "./theme";

const LABEL: Record<Exclude<ErrorAction, null | "use-suggestion">, string> = {
  retry: "Try again",
  "sign-in": "Sign in",
  update: "",
  "make-profile": "Make a profile",
};

/**
 * One short line and at most one action, the same everywhere an error surfaces
 * (services/user-message has the words). Sign in and Make a profile go where they say; Try again
 * calls `onRetry`.
 */
export function ErrorLine({
  text,
  action = null,
  onRetry,
  testID = "errorLine",
}: {
  text: string | null;
  action?: ErrorAction;
  onRetry?: () => void;
  testID?: string;
}) {
  const router = useRouter();
  if (!text) return null;
  const run =
    action === "retry"
      ? onRetry
      : action === "sign-in"
        ? () => router.push({ pathname: "/sign-in", params: { mode: "signin" } })
        : action === "make-profile"
          ? () => router.replace("/onboarding")
          : undefined;
  const label = action && action !== "use-suggestion" ? LABEL[action] : "";
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.text}>{text}</Text>
      {run && label ? (
        <Pressable
          testID={`${testID}Action`}
          accessibilityRole="button"
          onPress={run}
          style={styles.action}
        >
          <Text style={styles.actionText}>{label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", gap: 2 },
  text: { color: colors.peach, fontSize: 15, textAlign: "center", lineHeight: 21 },
  action: { minHeight: TARGET, justifyContent: "center", paddingHorizontal: 12 },
  actionText: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
