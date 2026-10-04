import type { FriendRequest } from "@open-game-system/ogs-protocol";
import { Text, View } from "react-native";
import { Button } from "../Button";
import { Sticker } from "../Sticker";
import { rowStyles as styles } from "./FriendRow";

/** A request to you (Accept / Decline), or one you sent (Cancel). */
export function RequestRow({
  request,
  incoming,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  incoming: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const who = incoming ? request.from : request.to;
  return (
    <View style={styles.row} testID={`request-${who.handle}`}>
      <Sticker id={who.sticker} size={48} seed={who.id} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {who.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {incoming ? `@${who.handle}` : `@${who.handle} · Sent`}
        </Text>
      </View>
      {incoming ? (
        <>
          <Button label="Accept" testID={`accept-${who.handle}`} onPress={onAccept} />
          <Button
            label="Decline"
            kind="ghost"
            testID={`decline-${who.handle}`}
            onPress={onDecline}
          />
        </>
      ) : (
        <Button label="Cancel" kind="ghost" testID={`cancel-${who.handle}`} onPress={onDecline} />
      )}
    </View>
  );
}
