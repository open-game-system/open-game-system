import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createProfileForm } from "../../../services/profile-form";
import { api, appState } from "../../../services/runtime";
import type { UserMessage } from "../../../services/user-message";
import { Button } from "../Button";
import { ErrorLine } from "../ErrorLine";
import { KeyboardFooterScroll } from "../KeyboardFooter";
import { ProfileFields } from "../profile/ProfileFields";
import { colors, fonts, TARGET } from "../theme";

/**
 * Onboarding's one profile step (spec ogs-profiles, 1 · 01): name typed, @id and sticker
 * pre-filled. Next makes the profile and this device's token. Same step on a kid's iPad.
 * Next stays on screen above the keyboard: no return key needed before it. So does "Already have a
 * profile? Sign in", for someone who has one (one profile per device: sign in, don't make another).
 */
export function ProfileStep({ onNext, onSignIn }: { onNext: () => void; onSignIn: () => void }) {
  const [form] = useState(() => createProfileForm({ checkHandle: (q) => api.checkHandle(q) }));
  useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UserMessage | null>(null);
  // The form's debounce timer must not outlive the page.
  useEffect(() => () => form.dispose(), [form]);
  const typing = useKeyboardUp();

  const next = async () => {
    if (busy || !form.canSubmit()) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    const result = await appState.createProfile(form.values());
    setBusy(false);
    if (result.ok) onNext();
    else if (result.reason === "handle_taken") form.taken(result.suggestion);
    else setError({ text: result.message, action: result.action });
  };

  return (
    <View style={styles.root}>
      <KeyboardFooterScroll
        contentContainerStyle={styles.page}
        footerStyle={styles.footer}
        testID="profileStep"
        footer={
          <>
            <ErrorLine
              text={error?.text ?? null}
              action={error?.action}
              onRetry={() => void next()}
              testID="profileStepError"
            />
            <Button
              label={busy ? "Making your profile…" : "Next"}
              testID="profileNext"
              disabled={busy || !form.canSubmit()}
              onPress={() => void next()}
            />
            <Pressable
              testID="profileStepSignIn"
              accessibilityRole="button"
              accessibilityLabel="Already have a profile? Sign in"
              disabled={busy}
              onPress={() => {
                Keyboard.dismiss();
                onSignIn();
              }}
              style={({ pressed }) => [styles.signIn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.signInText}>
                Already have a profile? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </Pressable>
          </>
        }
      >
        <Text style={styles.heading}>Make your OGS profile</Text>
        <Text style={styles.body}>Games use this name when you join.</Text>
        {/* While typing, the big sticker steps aside: nothing half-scrolled under the Back bar. */}
        <ProfileFields form={form} onSubmit={() => void next()} showPreview={!typing} />
      </KeyboardFooterScroll>
      {/* Content scrolled up (the keyboard's reveal) fades under the Back bar, never a hard cut. */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.dusk0, "rgba(18, 15, 34, 0)"]}
        style={styles.topFade}
      />
    </View>
  );
}

/** Whether the keyboard is up (an external system: an effect follows it). */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const subs = [
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
        setUp(true),
      ),
      Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
        setUp(false),
      ),
    ];
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, []);
  return up;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: {
    paddingHorizontal: 24,
    // At rest the fade above covers only this padding, never the heading.
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  topFade: { position: "absolute", top: 0, left: 0, right: 0, height: 16 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4, gap: 4 },
  signIn: { minHeight: TARGET, alignItems: "center", justifyContent: "center" },
  signInText: { color: colors.cream2, fontSize: 15 },
  signInLink: { color: colors.peach, fontWeight: "700" },
  heading: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  body: { color: colors.cream2, fontSize: 16, lineHeight: 22, marginBottom: 6 },
});
