import { useRouter } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Keyboard, StyleSheet } from "react-native";
import { Button } from "../components/ogs/Button";
import { ErrorLine } from "../components/ogs/ErrorLine";
import { ProfileFields } from "../components/ogs/profile/ProfileFields";
import { Screen } from "../components/ogs/Screen";
import { createProfileForm } from "../services/profile-form";
import { api, appState } from "../services/runtime";
import type { ErrorAction } from "../services/user-message";

/** Profile tab → Edit: name, @id and sticker (PATCH /me). Save stays above the keyboard. */
export default function EditProfileScreen() {
  const router = useRouter();
  const [form] = useState(() => {
    const p = appState.getSnapshot().identity?.profile;
    return createProfileForm({
      checkHandle: (q) => api.checkHandle(q),
      initial: p ? { name: p.name, handle: p.handle, sticker: p.sticker } : undefined,
    });
  });
  useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; action: ErrorAction } | null>(null);
  // The form's debounce timer must not outlive the screen.
  useEffect(() => () => form.dispose(), [form]);

  const save = async () => {
    if (busy || !form.canSubmit()) return;
    Keyboard.dismiss();
    const changes = form.changes();
    if (Object.keys(changes).length === 0) {
      router.back();
      return;
    }
    setBusy(true);
    setError(null);
    const result = await appState.updateProfile(changes);
    setBusy(false);
    if (result.ok) router.back();
    else if (result.reason === "handle_taken") form.taken(result.suggestion);
    else setError({ text: result.message, action: result.action });
  };

  return (
    <Screen
      title="Edit profile"
      testID="editProfileScreen"
      footer={
        <>
          <ErrorLine
            text={error?.text ?? null}
            action={error?.action}
            onRetry={() => void save()}
            testID="editProfileError"
          />
          <Button
            label={busy ? "Saving…" : "Save"}
            testID="editProfileSave"
            disabled={busy || !form.canSubmit()}
            onPress={() => void save()}
          />
        </>
      }
    >
      <ProfileFields form={form} onSubmit={() => void save()} />
      <Button label="Cancel" kind="ghost" onPress={() => router.back()} style={styles.cancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({ cancel: { marginTop: 20 } });
