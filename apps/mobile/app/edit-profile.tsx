import { useRouter } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "../components/ogs/Button";
import { ErrorLine } from "../components/ogs/ErrorLine";
import { ProfileFields } from "../components/ogs/profile/ProfileFields";
import { Screen } from "../components/ogs/Screen";
import { createProfileForm } from "../services/profile-form";
import { api, appState } from "../services/runtime";
import type { ErrorAction } from "../services/user-message";

/** Profile tab → Edit: name, @id and sticker (PATCH /me). */
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
    <Screen title="Edit profile" testID="editProfileScreen">
      <ProfileFields form={form} />
      <View style={styles.actions}>
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
        <Button label="Cancel" kind="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { gap: 10, marginTop: 20 } });
