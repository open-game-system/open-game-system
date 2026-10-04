import { useRouter } from "expo-router";
import { KidsList } from "../../components/ogs/profile/KidsList";
import { ProfileCard } from "../../components/ogs/profile/ProfileCard";
import { profileView } from "../../components/ogs/profile/profile-view";
import { SettingsLink } from "../../components/ogs/profile/SettingsLink";
import { Screen } from "../../components/ogs/Screen";
import { useApp } from "../../services/runtime";

/** Profile tab: you, the kids you manage, and Settings (the household button's old job). */
export default function ProfileScreen() {
  const router = useRouter();
  const { me, kids } = profileView(useApp().identity);
  return (
    <Screen title="Profile" testID="profileScreen">
      <ProfileCard me={me} />
      <KidsList kids={kids} />
      <SettingsLink onPress={() => router.push("/settings")} />
    </Screen>
  );
}
