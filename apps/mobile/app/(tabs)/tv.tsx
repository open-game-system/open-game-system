import { useRouter } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ogs/Button";
import { RemotePad } from "../../components/ogs/RemotePad";
import { HolderLine, NowOnTv } from "../../components/ogs/remote/NowOnTv";
import { type OnTv, pickerDevices, remoteView } from "../../components/ogs/remote/remote-view";
import { StopCasting } from "../../components/ogs/remote/StopCasting";
import { TvPicker } from "../../components/ogs/remote/TvPicker";
import { Screen } from "../../components/ogs/Screen";
import { colors, fonts, TARGET } from "../../components/ogs/theme";
import { switchTv } from "../../services/cast-flow";
import type { CastDevice } from "../../services/cast-store";
import { remotePress } from "../../services/remote";
import {
  api,
  castBackend,
  castNow,
  castStore,
  config,
  couchHub,
  deviceId,
  endTonight,
  useApp,
  useCast,
  useCouch,
  useOgsCast,
} from "../../services/runtime";

const SEARCH_MS = 4000;

const useDevices = () =>
  useSyncExternalStore(
    castBackend.subscribeDevices,
    castBackend.getDevices,
    castBackend.getDevices,
  );

/**
 * Spec v3: TV is a big Cast button until you cast, then the remote. No TV found lists the likely
 * causes first, then other ways to play.
 */
export default function TvScreen() {
  const cast = useOgsCast();
  const castState = useCast();
  if (cast) return <Remote tvName={castState.session.deviceName ?? "the TV"} />;
  return <NotCast connecting={castState.session.status === "connecting"} />;
}

function Remote({ tvName }: { tvName: string }) {
  const couch = useCouch();
  const app = useApp();
  const castState = useCast();
  const found = useDevices();
  const [picking, setPicking] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const view = remoteView({
    state: couch.state,
    library: app.library,
    people: app.identity?.people ?? [],
    myDeviceId: deviceId(),
  });
  const currentId = castState.session.deviceId;
  const devices = pickerDevices(found, currentId ? { id: currentId, name: tvName } : null);

  const press = (button: Parameters<typeof remotePress>[0]) => {
    const { messages, stopCast } = remotePress(button, deviceId());
    if (stopCast) void endTonight();
    else for (const m of messages) couchHub.send(m);
  };
  const openPicker = () => {
    castBackend.startDiscovery();
    setPickError(null);
    setPicking(true);
  };
  const pick = async (tv: CastDevice) => {
    setSwitchingId(tv.id);
    setPickError(null);
    try {
      const result = await switchTv({
        api,
        config,
        castStore,
        backend: castBackend,
        deviceId: tv.id,
      });
      if (result === "no-tv") setPickError(`Couldn't reach ${tv.name}. Is it on?`);
      else setPicking(false);
    } catch (err) {
      setPickError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <Screen
      title="TV"
      testID="tvRemote"
      right={
        <StopCasting
          tvName={tvName}
          gameName={view.onTv.kind === "game" ? view.onTv.name : pausedName(view.onTv)}
          onStop={() => press("end")}
        />
      }
    >
      <NowOnTv onTv={view.onTv} tvName={tvName} onChangeTv={openPicker} />
      <View style={styles.padArea}>
        <HolderLine holder={view.holder} />
        <RemotePad onPress={press} />
      </View>
      <TvPicker
        visible={picking}
        devices={devices}
        currentId={currentId}
        switchingId={switchingId}
        error={pickError}
        onPick={(tv) => void pick(tv)}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const pausedName = (onTv: OnTv) => (onTv.kind === "home" ? onTv.paused : null);

function NotCast({ connecting }: { connecting: boolean }) {
  const router = useRouter();
  const devices = useDevices();
  const [phase, setPhase] = useState<"idle" | "searching" | "no-tv">("idle");
  const [picked, setPicked] = useState<CastDevice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    castBackend.startDiscovery();
  }, []);

  // Searching ends when a TV appears or the search times out (a timer: legitimate effect).
  useEffect(() => {
    if (phase !== "searching") return;
    if (devices.length > 0) {
      setPhase("idle");
      return;
    }
    const t = setTimeout(() => setPhase("no-tv"), SEARCH_MS);
    return () => clearTimeout(t);
  }, [phase, devices.length]);

  const tv = picked ?? devices[0] ?? null;

  const onCast = async () => {
    setError(null);
    if (!tv) {
      castBackend.startDiscovery();
      setPhase("searching");
      return;
    }
    try {
      const result = await castNow(tv.id);
      if (result === "no-tv") setPhase("no-tv");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (phase === "no-tv")
    return (
      <Screen title="TV" testID="tvNoTv">
        <Text style={styles.headline}>No TV found</Text>
        <Text style={styles.lead}>Usually it's one of these:</Text>
        {[
          [
            "Local Network is off for OGS",
            "Settings › OGS › Local Network lets OGS see your Chromecast.",
          ],
          ["Different Wi-Fi", "Your phone and the TV need to be on the same Wi-Fi."],
          ["The TV is asleep", "Turn the TV on and switch to the Chromecast's input."],
        ].map(([title, body]) => (
          <View key={title} style={styles.cause}>
            <Text style={styles.causeTitle}>{title}</Text>
            <Text style={styles.causeBody}>{body}</Text>
          </View>
        ))}
        <View style={styles.actions}>
          <Button
            label="Try again"
            testID="castRetry"
            onPress={() => {
              castBackend.startDiscovery();
              setPhase("searching");
            }}
          />
          <Button label="Open Settings" kind="ghost" onPress={() => void Linking.openSettings()} />
        </View>
        <Text style={styles.otherTitle}>Other ways to play</Text>
        <Pressable
          testID="playOnPhone"
          accessibilityRole="button"
          style={styles.other}
          onPress={() => router.navigate("/library")}
        >
          <Text style={styles.otherText}>Play on this phone: games that don't need a TV</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Screen>
    );

  return (
    <Screen title="TV" testID="tvNotCast">
      <Text style={styles.lead}>
        Cast once and the TV becomes your game console for the evening.
      </Text>
      <View style={styles.center}>
        <Pressable
          testID="castButton"
          accessibilityRole="button"
          accessibilityLabel={tv ? `Cast to ${tv.name}` : "Cast"}
          disabled={connecting || phase === "searching"}
          onPress={() => void onCast()}
          style={({ pressed }) => [styles.cast, pressed && { opacity: 0.85 }]}
        >
          {connecting || phase === "searching" ? (
            <ActivityIndicator color={colors.ink} size="large" />
          ) : (
            <Text style={styles.castText}>Cast</Text>
          )}
        </Pressable>
        <Text style={styles.tvName} testID="castTarget">
          {connecting
            ? `Connecting to ${tv?.name ?? "the TV"}…`
            : phase === "searching"
              ? "Looking for TVs…"
              : (tv?.name ?? "Looking for TVs…")}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      {devices.length > 1 ? (
        <View style={styles.choices}>
          <Text style={styles.otherTitle}>Which TV?</Text>
          {devices.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: tv?.id === d.id }}
              onPress={() => setPicked(d)}
              style={[styles.choice, tv?.id === d.id && styles.choiceOn]}
            >
              <Text style={styles.choiceText}>{d.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const CAST = 168;
const styles = StyleSheet.create({
  lead: { color: colors.cream2, fontSize: 17, lineHeight: 24 },
  headline: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, marginBottom: 6 },
  center: { alignItems: "center", marginTop: 48, gap: 18 },
  cast: {
    width: CAST,
    height: CAST,
    borderRadius: CAST / 2,
    backgroundColor: colors.peach,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.ember,
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
  },
  castText: { fontFamily: fonts.display, fontSize: 40, color: colors.ink },
  tvName: { color: colors.cream, fontSize: 18, fontWeight: "700" },
  error: { color: colors.peach, fontSize: 15, textAlign: "center" },
  padArea: { alignItems: "center", marginTop: 18, marginBottom: 10, gap: 6 },
  cause: { backgroundColor: colors.dusk1, borderRadius: 16, padding: 14, marginTop: 10 },
  causeTitle: { color: colors.cream, fontSize: 17, fontWeight: "700" },
  causeBody: { color: colors.cream3, fontSize: 15, marginTop: 4, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 12, marginTop: 18 },
  otherTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.cream,
    marginTop: 30,
    marginBottom: 8,
  },
  other: {
    minHeight: TARGET + 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hair,
  },
  otherText: { flex: 1, color: colors.cream2, fontSize: 16 },
  chevron: { color: colors.cream3, fontSize: 26 },
  choices: { marginTop: 10 },
  choice: {
    minHeight: TARGET + 4,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.dusk1,
    marginTop: 8,
  },
  choiceOn: { borderWidth: 2, borderColor: colors.peach },
  choiceText: { color: colors.cream, fontSize: 16, fontWeight: "600" },
});
