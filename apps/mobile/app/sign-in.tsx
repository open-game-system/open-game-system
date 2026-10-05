import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/ogs/Button";
import { ErrorLine } from "../components/ogs/ErrorLine";
import { Screen } from "../components/ogs/Screen";
import { colors, TARGET } from "../components/ogs/theme";
import { markOnboardingComplete } from "../services/onboarding";
import { appState } from "../services/runtime";
import { createSignInFlow, type SignInMode } from "../services/sign-in-flow";

/**
 * Back up your profile (from onboarding's last page or the Profile tab) or sign in to an existing
 * one (onboarding's "I already have a profile"). Email only for now: it opens on the address.
 * Spec ogs-profiles, 1 · 04.
 */
export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: SignInMode = params.mode === "signin" ? "signin" : "backup";
  const [flow] = useState(() =>
    createSignInFlow({
      mode,
      app: {
        startEmail: (email) => appState.startEmail(email),
        backUp: (c) => appState.backUp(c),
        signIn: (c) => appState.signIn(c),
      },
    }),
  );
  const s = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Done: a backed-up profile returns where it came from; a signed-in device starts the app.
  useEffect(() => {
    if (s.step !== "done") return;
    if (mode === "backup") router.back();
    else void markOnboardingComplete().then(() => router.replace("/"));
  }, [s.step, mode, router]);

  const title = mode === "backup" ? "Back up your profile" : "Sign in";
  const lead =
    mode === "backup"
      ? "Keep your @id and friends on a new phone."
      : "Sign in with the email you backed up your profile with.";

  return (
    <Screen title={title} testID="signInScreen">
      <Text style={styles.lead}>{lead}</Text>
      {s.step === "email" ? (
        <View style={styles.stack}>
          <TextInput
            testID="signInEmailInput"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.cream3}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <Button
            label="Send code"
            testID="signInSendCode"
            disabled={s.busy}
            onPress={() => void flow.sendCode(email)}
          />
          <Text style={styles.hint}>We'll send a 6-digit code.</Text>
        </View>
      ) : null}
      {s.step === "code" ? (
        <View style={styles.stack}>
          <Text style={styles.hint}>We sent a 6-digit code to {s.email}.</Text>
          <TextInput
            testID="signInCodeInput"
            value={code}
            onChangeText={setCode}
            style={[styles.input, styles.code]}
            placeholder="123456"
            placeholderTextColor={colors.cream3}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={7}
          />
          <Button
            label={mode === "backup" ? "Back up" : "Sign in"}
            testID="signInVerify"
            disabled={s.busy}
            onPress={() => void flow.verify(code)}
          />
          <Button label="Use another email" kind="ghost" onPress={() => flow.back()} />
        </View>
      ) : null}
      {s.step === "not_found" ? (
        <View style={styles.stack} testID="signInNotFound">
          <Text style={styles.lead}>No OGS profile has that login yet.</Text>
          <Button
            label="Make a profile"
            testID="signInMakeProfile"
            onPress={() => void appState.signOut().then(() => router.replace("/onboarding"))}
          />
        </View>
      ) : null}
      {s.busy ? <ActivityIndicator color={colors.cream3} style={styles.busy} /> : null}
      <View style={styles.error}>
        <ErrorLine text={s.error} testID="signInError" />
      </View>
      {s.step !== "done" ? (
        <Button
          label="Not now"
          kind="ghost"
          testID="signInNotNow"
          onPress={() => router.back()}
          style={styles.notNow}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.cream2, fontSize: 17, lineHeight: 24, marginBottom: 18 },
  stack: { gap: 12 },
  hint: { color: colors.cream3, fontSize: 14, textAlign: "center" },
  input: {
    minHeight: TARGET + 4,
    borderRadius: 12,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    color: colors.cream,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  code: { fontSize: 26, letterSpacing: 8, textAlign: "center" },
  busy: { marginTop: 16 },
  error: { marginTop: 16 },
  notNow: { marginTop: 24 },
});
