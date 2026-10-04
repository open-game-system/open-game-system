import { Share } from "react-native";
import { FriendsEmpty } from "../../components/ogs/friends/FriendsEmpty";
import { inviteLink, inviteMessage } from "../../components/ogs/friends/invite";
import { profileView } from "../../components/ogs/profile/profile-view";
import { Screen } from "../../components/ogs/Screen";
import { useApp } from "../../services/runtime";

/** Friends tab: empty until the profiles backend exists; "Share my profile" works today. */
export default function FriendsScreen() {
  const me = profileView(useApp().identity);
  const link = inviteLink(me?.id ?? null);
  const share =
    me && link ? () => void Share.share({ message: inviteMessage(me.name, link) }) : null;
  return (
    <Screen title="Friends" testID="friendsScreen">
      <FriendsEmpty onShare={share} />
    </Screen>
  );
}
