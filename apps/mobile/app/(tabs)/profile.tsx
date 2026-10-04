import { useRouter } from "expo-router";
import { BackupRow } from "../../components/ogs/profile/BackupRow";
import { ProfileCard } from "../../components/ogs/profile/ProfileCard";
import { backupView, profileView } from "../../components/ogs/profile/profile-view";
import { SettingsLink } from "../../components/ogs/profile/SettingsLink";
import { Screen } from "../../components/ogs/Screen";
import { useApp } from "../../services/runtime";

/** Profile tab: you (sticker, name, @id · Edit), back-up status, and Settings. */
export default function ProfileScreen() {
  const router = useRouter();
  const app = useApp();
  const backup = backupView(app.logins);
  return (
    <Screen title="Profile" testID="profileScreen">
      <ProfileCard me={profileView(app.identity)} onEdit={() => router.push("/edit-profile")} />
      <BackupRow
        {...backup}
        onBackUp={() => router.push({ pathname: "/sign-in", params: { mode: "backup" } })}
      />
      <SettingsLink onPress={() => router.push("/settings")} />
    </Screen>
  );
}
