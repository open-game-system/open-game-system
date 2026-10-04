import {
  type FriendInvite,
  formatInviteCode,
  inviteTokenFromUrl,
} from "@open-game-system/ogs-protocol";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../components/ogs/Button";
import { ErrorLine } from "../components/ogs/ErrorLine";
import { inviteMessage } from "../components/ogs/friends/invite";
import { QrCode } from "../components/ogs/friends/QrCode";
import { Screen } from "../components/ogs/Screen";
import { colors, fonts, TARGET } from "../components/ogs/theme";
import { friendsStore } from "../services/friends-runtime";
import { useApp } from "../services/runtime";
import type { ErrorAction } from "../services/user-message";

type Line = { text: string; action: ErrorAction; good: boolean } | null;

/**
 * Add a friend (spec ogs-profiles 2 · 02): my QR (in the room: they scan it, friends at once), my
 * code (10 min), Share invite link, their code, and Find by @id. The QR holds the app link
 * (opengame://add/<token>), so the iPhone Camera opens OGS on it.
 */
export default function AddFriendScreen() {
  const router = useRouter();
  const me = useApp().identity?.profile ?? null;
  const [invite, setInvite] = useState<FriendInvite | null>(null);
  const [inviteError, setInviteError] = useState<Line>(null);
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [line, setLine] = useState<Line>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setInviteError(null);
    const r = await friendsStore.newInvite();
    if (r.ok) setInvite(r.invite);
    else setInviteError({ text: r.message, action: r.action, good: false });
  }, []);
  // A fresh invite each time the screen shows (single use, 10 minutes).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const qrToken = invite ? inviteTokenFromUrl(invite.qr) : null;
  const expired = invite !== null && invite.expiresAt <= Date.now();

  const submit = async (
    run: () => Promise<
      | { ok: true; outcome: "friends" | "requested"; name: string }
      | { ok: false; message: string; action: ErrorAction }
    >,
    clear: () => void,
  ) => {
    setBusy(true);
    setLine(null);
    const r = await run();
    setBusy(false);
    if (!r.ok) return setLine({ text: r.message, action: r.action, good: false });
    clear();
    setLine({
      text:
        r.outcome === "friends"
          ? `You and ${r.name} are friends.`
          : `Sent. ${r.name} will see your request in Friends.`,
      action: null,
      good: true,
    });
  };

  return (
    <Screen
      title="Add a friend"
      testID="addFriendScreen"
      right={
        <Pressable
          testID="addFriendClose"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.close}
        >
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      }
    >
      <View style={styles.qrBox}>
        <Text style={styles.lead}>In the room: they scan this.</Text>
        {qrToken && !expired ? (
          <QrCode value={`opengame://add/${qrToken}`} testID="inviteQr" />
        ) : (
          <View style={styles.qrPlaceholder} />
        )}
        <Text style={styles.code} testID="inviteCode" selectable>
          {invite && !expired ? formatInviteCode(invite.code) : "······"}
        </Text>
        <Text style={styles.hint}>Or type the code. 10 min.</Text>
        {expired ? (
          <Button label="New code" kind="ghost" testID="inviteRenew" onPress={() => void load()} />
        ) : null}
        <ErrorLine
          text={inviteError?.text ?? null}
          action={inviteError?.action}
          onRetry={() => void load()}
          testID="inviteError"
        />
      </View>

      <Button
        label="Share invite link"
        testID="shareInvite"
        disabled={!invite || expired}
        onPress={() => {
          if (invite && me) void Share.share({ message: inviteMessage(me.name, invite.link) });
        }}
      />

      <Text style={styles.section}>Scan their code</Text>
      <Text style={styles.hint}>
        Point your iPhone Camera at their QR and tap Open in OGS. Or type their code:
      </Text>
      <View style={styles.row}>
        <TextInput
          testID="friendCodeInput"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          style={[styles.input, styles.codeInput]}
          placeholder="KITE-42"
          placeholderTextColor={colors.cream3}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          accessibilityLabel="Their code"
        />
        <Button
          label="Add"
          testID="friendCodeAdd"
          disabled={busy || code.trim().length < 6}
          onPress={() =>
            void submit(
              () => friendsStore.addByCode(code),
              () => setCode(""),
            )
          }
        />
      </View>

      <Text style={styles.section}>Find by @id</Text>
      <View style={styles.row}>
        <TextInput
          testID="friendHandleInput"
          value={handle}
          onChangeText={setHandle}
          style={styles.input}
          placeholder="@juneau.m"
          placeholderTextColor={colors.cream3}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Their @id"
        />
        <Button
          label="Send"
          testID="friendHandleSend"
          disabled={busy || handle.trim().replace(/^@/, "").length === 0}
          onPress={() =>
            void submit(
              () => friendsStore.addByHandle(handle),
              () => setHandle(""),
            )
          }
        />
      </View>

      {line?.good ? (
        <Text style={styles.good} testID="addFriendDone">
          {line.text}
        </Text>
      ) : (
        <ErrorLine text={line?.text ?? null} action={line?.action} testID="addFriendError" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrBox: { alignItems: "center", gap: 10, marginBottom: 18 },
  lead: { color: colors.cream2, fontSize: 17 },
  qrPlaceholder: { width: 220, height: 220, borderRadius: 16, backgroundColor: colors.dusk2 },
  code: { fontFamily: fonts.display, fontSize: 40, color: colors.cream, letterSpacing: 4 },
  hint: { color: colors.cream3, fontSize: 15, lineHeight: 21 },
  section: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.cream,
    marginTop: 26,
    marginBottom: 6,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
  input: {
    flex: 1,
    minHeight: TARGET + 4,
    borderRadius: 12,
    backgroundColor: colors.dusk1,
    borderWidth: 1,
    borderColor: colors.hair,
    color: colors.cream,
    paddingHorizontal: 12,
    fontSize: 18,
  },
  codeInput: { letterSpacing: 4, fontSize: 20 },
  good: { color: colors.mint, fontSize: 16, textAlign: "center", marginTop: 16 },
  close: { minHeight: TARGET, justifyContent: "center", paddingHorizontal: 8 },
  closeText: { color: colors.peach, fontSize: 17, fontWeight: "700" },
});
