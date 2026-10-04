import { useEffect, useState, useSyncExternalStore } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { createProfileForm } from "../../../services/profile-form";
import { api, appState } from "../../../services/runtime";
import { Button } from "../Button";
import { ProfileFields } from "../profile/ProfileFields";
import { colors, fonts } from "../theme";

/**
 * Onboarding's one profile step (spec ogs-profiles, 1 · 01): name typed, @id and sticker
 * pre-filled. Next makes the profile and this device's token. Same step on a kid's iPad.
 */
export function ProfileStep({ onNext }: { onNext: () => void }) {
  const [form] = useState(() => createProfileForm({ checkHandle: (q) => api.checkHandle(q) }));
  useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The form's debounce timer must not outlive the page.
  useEffect(() => () => form.dispose(), [form]);

  const next = async () => {
    setBusy(true);
    setError(null);
    const result = await appState.createProfile(form.values());
    setBusy(false);
    if (result.ok) onNext();
    else if (result.reason === "handle_taken") form.taken(result.suggestion);
    else setError(`Can't reach OGS to make your profile (${result.message}). Try again.`);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        testID="profileStep"
      >
        <Text style={styles.heading}>Make your OGS profile</Text>
        <Text style={styles.body}>Games use this name when you join.</Text>
        <ProfileFields form={form} />
        {error ? (
          <Text style={styles.error} testID="profileStepError">
            {error}
          </Text>
        ) : null}
        <Button
          label={busy ? "Making your profile…" : "Next"}
          testID="profileNext"
          disabled={busy || !form.canSubmit()}
          onPress={() => void next()}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  heading: { fontFamily: fonts.display, fontSize: 30, color: colors.cream },
  body: { color: colors.cream2, fontSize: 16, lineHeight: 22, marginBottom: 6 },
  error: { color: colors.peach, fontSize: 15 },
});
