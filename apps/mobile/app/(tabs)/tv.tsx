import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/ogs/Button";
import { ErrorLine } from "../../components/ogs/ErrorLine";
import { padSize, RemotePad } from "../../components/ogs/RemotePad";
import { JoinTv } from "../../components/ogs/remote/JoinTv";
import { castTarget, lastStop } from "../../components/ogs/remote/last-stop";
import { HolderLine, NowOnTv } from "../../components/ogs/remote/NowOnTv";
import {
  castControls,
  type OnTv,
  pickerDevices,
  remoteView,
} from "../../components/ogs/remote/remote-view";
import { StopCasting } from "../../components/ogs/remote/StopCasting";
import { TvPicker } from "../../components/ogs/remote/TvPicker";
import { tvMirror } from "../../components/ogs/remote/tv-mirror";
import { Screen } from "../../components/ogs/Screen";
import { colors, fonts, TARGET } from "../../components/ogs/theme";
import type { CastDevice } from "../../services/cast-store";
import { remotePress } from "../../services/remote";
import {
  appState,
  castBackend,
  castNow,
  couchHub,
  deviceId,
  endTonight,
  moveToTv,
  useApp,
  useCast,
  useCouch,
  useOgsCast,
} from "../../services/runtime";
import { type UserMessage, userMessage } from "../../services/user-message";

const SEARCH_MS = 4000;
/** How long the TV picker shows "Looking for TVs…" after it opens. */
const SCAN_MS = 4000;

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
  if (cast) return <Remote castDeviceName={castState.session.deviceName} />;
  return <NotCast connecting={castState.session.status === "connecting"} />;
}

/** The pad area's room for the holder line above the pad. */
const HOLDER_ROOM = 58;

function Remote({ castDeviceName }: { castDeviceName: string | null }) {
  const insets = useSafeAreaInsets();
  const couch = useCouch();
  const app = useApp();
  const castState = useCast();
  const found = useDevices();
  const [picking, setPicking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [room, setRoom] = useState(0);
  const view = remoteView({
    state: couch.state,
    library: app.library,
    myDeviceId: deviceId(),
  });
  const mirror = tvMirror({ state: couch.state, library: app.library, now: Date.now() });
  const controls = castControls({
    session: app.session,
    castDeviceName,
    gameName: view.onTv.kind === "game" ? view.onTv.name : pausedName(view.onTv),
  });
  const tvName = controls.tvName;
  const currentId = castState.session.deviceId;
  const devices = pickerDevices(found, currentId ? { id: currentId, name: tvName } : null);

  // Back on the remote: the "Stopped casting" note on the Cast screen is old news.
  useEffect(() => lastStop.clear(), []);
  // The picker's search runs for a few seconds after it opens (a timer: legitimate effect).
  useEffect(() => {
    if (!searching) return;
    const t = setTimeout(() => setSearching(false), SCAN_MS);
    return () => clearTimeout(t);
  }, [searching]);

  const press = (button: Parameters<typeof remotePress>[0]) => {
    const { messages, stopCast } = remotePress(button, deviceId());
    // A device that joined leaves the couch; only the caster stops the cast.
    if (!stopCast) for (const m of messages) couchHub.send(m);
    else if (controls.role === "member") void appState.leaveSession();
    else {
      if (currentId) lastStop.stopped({ id: currentId, name: tvName });
      void endTonight();
    }
  };
  const search = () => {
    castBackend.startDiscovery();
    setSearching(true);
  };
  const openPicker = () => {
    search();
    setPickError(null);
    setPicking(true);
  };
  const pick = async (tv: CastDevice) => {
    setSwitchingId(tv.id);
    setPickError(null);
    try {
      const result = await moveToTv(tv);
      if (result === "no-tv") setPickError(`Couldn't reach ${tv.name}. Is it on?`);
      else setPicking(false);
    } catch (err) {
      setPickError(userMessage(err, "cast").text);
    } finally {
      setSwitchingId(null);
    }
  };
  const end = <StopCasting end={controls.end} onStop={() => press("end")} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]} testID="tvRemote">
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          TV
        </Text>
        {controls.changeTv ? end : null}
      </View>
      <NowOnTv
        mirror={mirror}
        library={app.library}
        tvName={tvName}
        changeTv={controls.changeTv}
        onChangeTv={openPicker}
        rowEnd={controls.changeTv ? null : end}
      />
      <View style={styles.padArea} onLayout={(e) => setRoom(e.nativeEvent.layout.height)}>
        <HolderLine holder={view.holder} />
        <RemotePad size={padSize(room - HOLDER_ROOM)} onPress={press} />
      </View>
      <TvPicker
        visible={picking}
        devices={devices}
        currentId={currentId}
        switchingId={switchingId}
        error={pickError}
        searching={searching}
        onPick={(tv) => void pick(tv)}
        onRescan={search}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const pausedName = (onTv: OnTv) => (onTv.kind === "home" ? onTv.paused : null);

function NotCast({ connecting }: { connecting: boolean }) {
  const router = useRouter();
  const devices = useDevices();
  const [phase, setPhase] = useState<"idle" | "searching" | "no-tv">("idle");
  const [picked, setPicked] = useState<CastDevice | null>(null);
  const [error, setError] = useState<UserMessage | null>(null);
  const session = useApp().session;
  const stopped = useSyncExternalStore(lastStop.subscribe, lastStop.get, lastStop.get);

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

  const tv = castTarget(devices, picked, stopped);

  const onCast = async () => {
    setError(null);
    if (!tv) {
      castBackend.startDiscovery();
      setPhase("searching");
      return;
    }
    try {
      const result = await castNow(tv);
      if (result === "no-tv") setPhase("no-tv");
    } catch (err) {
      setError(userMessage(err, "cast"));
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
      {stopped ? (
        <View testID="castStopped">
          <Text style={styles.headline}>Stopped casting on {stopped.name}</Text>
          <Text style={styles.lead}>
            Your games keep their place. Cast again to pick them back up.
          </Text>
        </View>
      ) : (
        <Text style={styles.lead}>
          Cast once and the TV becomes your game console for the evening.
        </Text>
      )}
      <View style={styles.center}>
        <Pressable
          testID="castButton"
          accessibilityRole="button"
          accessibilityLabel={tv ? `${stopped ? "Cast again" : "Cast"} to ${tv.name}` : "Cast"}
          disabled={connecting || phase === "searching"}
          onPress={() => void onCast()}
          style={({ pressed }) => [styles.cast, pressed && { opacity: 0.85 }]}
        >
          {connecting || phase === "searching" ? (
            <ActivityIndicator color={colors.ink} size="large" />
          ) : (
            <Text style={[styles.castText, stopped && styles.castAgain]}>
              {stopped ? "Cast again" : "Cast"}
            </Text>
          )}
        </Pressable>
        <Text style={styles.tvName} testID="castTarget">
          {connecting
            ? `Connecting to ${tv?.name ?? "the TV"}…`
            : phase === "searching"
              ? "Looking for TVs…"
              : (tv?.name ?? "Looking for TVs…")}
        </Text>
        <ErrorLine
          text={error?.text ?? null}
          action={error?.action}
          onRetry={() => void onCast()}
          testID="castError"
        />
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
      <JoinTv joined={session} />
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
  castAgain: { fontSize: 30, textAlign: "center" },
  root: { flex: 1, backgroundColor: colors.dusk0, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    minHeight: 44,
  },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.cream },
  tvName: { color: colors.cream, fontSize: 18, fontWeight: "700" },
  padArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingBottom: 10,
  },
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
