import type { Instance, SectionKind } from "@open-game-system/ogs-protocol";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../../components/ogs/Button";
import { ErrorLine } from "../../components/ogs/ErrorLine";
import { FriendCastingCards } from "../../components/ogs/friends/FriendCastingCard";
import { CastStrip } from "../../components/ogs/playing/CastStrip";
import { HeroSitting } from "../../components/ogs/playing/HeroSitting";
import { PlayingNotice } from "../../components/ogs/playing/PlayingNotice";
import { SittingCard } from "../../components/ogs/playing/SittingCard";
import { StartTonight } from "../../components/ogs/playing/StartTonight";
import { Screen, SectionTitle } from "../../components/ogs/Screen";
import { colors, fonts } from "../../components/ogs/theme";
import {
  asSitting,
  heroSitting,
  liveHeadline,
  liveVerb,
  sharedLine,
  sittingRows,
  startedBy,
  whatToStart,
} from "../../services/playing-home";
import {
  appState,
  deviceId,
  useApp,
  useCast,
  useCouch,
  useOgsCast,
  usePlaying,
} from "../../services/runtime";

const TITLES: Record<SectionKind, string> = {
  yourTurn: "Your turn",
  tonight: "Tonight",
  paused: "In progress",
  waiting: "Waiting on them",
  finished: "Finished",
};

/**
 * Spec v3: everything in flight. One hero leads (the game live on the TV, else your turn or the
 * sitting you played last), the other sittings follow as cards, then what to start.
 */
export default function PlayingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const { state } = useCouch();
  const castState = useCast();
  const cast = useOgsCast();
  const view = usePlaying();
  useFocusEffect(
    useCallback(() => {
      void appState.refresh();
    }, []),
  );
  const now = Date.now();
  const games = [...app.library, ...app.catalogue];
  const find = (appId: string) => games.find((g) => g.appId === appId);
  const tvName = cast ? (castState.session?.deviceName ?? null) : null;

  const current = state?.current;
  const liveGame = current ? find(current.appId) : undefined;
  const live = !!(current && liveGame);
  const items = view.sections.flatMap((s) => s.items);
  const hero = heroSitting(items, live);
  const heroGame = hero ? find(hero.appId) : undefined;
  const liveName = live && liveGame ? liveGame.name : null;
  const rows = sittingRows(items, find, now, cast, liveName);
  const offline = app.status === "offline";
  const sectionWhere = (group: Instance[]) =>
    sharedLine(group.flatMap((i) => rows.get(i.instanceId)?.where ?? []));
  const heroRow = hero ? rows.get(hero.instanceId) : undefined;
  const inProgress = live || items.some((i) => i.status !== "completed");

  const start = whatToStart({
    status: app.status,
    error: app.error,
    library: app.library,
    catalogue: app.catalogue,
    instances: app.instances,
    cast,
    tvName,
    liveName,
    now,
    exclude: inProgress
      ? [...items.map((i) => i.appId), ...(current ? [current.appId] : [])]
      : undefined,
  });
  const toTv = () => router.navigate("/tv");
  const liveBy = state && current ? startedBy(state, current.hostDeviceId, deviceId()) : null;
  const retry = () => void appState.init().then(appState.refresh);

  return (
    <View style={styles.root}>
      <Screen title="Playing" testID="playingScreen">
        {offline && start.kind !== "offline" ? (
          // Showing what loaded last; say it may be out of date, with its one action.
          <ErrorLine
            text={app.error?.text ?? null}
            action={app.error?.action}
            onRetry={retry}
            testID="playingStale"
          />
        ) : null}
        {/* A friend's cast leads (slice 2): renders nothing when no friend is casting. */}
        {offline ? null : <FriendCastingCards />}
        {offline ? null : cast ? (
          // Unverifiable while OGS can't be reached, so the TV isn't claimed then.
          <CastStrip tvName={tvName ?? "the TV"} onTv={toTv} />
        ) : inProgress ? (
          <CastStrip tvName={null} onTv={toTv} />
        ) : null}

        {current && liveGame ? (
          <HeroSitting
            testID="nowPlaying"
            buttonTestID="nowPlayingBackIn"
            game={liveGame}
            tag="Live on the TV"
            live
            sitting={null}
            headline={liveHeadline(current, now)}
            meta={liveBy ? `${liveBy} started it` : null}
            verb={liveVerb(liveBy)}
          />
        ) : hero && heroGame ? (
          <HeroSitting
            testID="playingHero"
            compact={items.length > 1}
            buttonTestID={`playingItem-${hero.instanceId}`}
            game={heroGame}
            tag={heroRow?.where ?? ""}
            live={false}
            headline={heroRow?.headline ?? ""}
            meta={
              [hero.status === "waiting" ? "Your turn" : "", heroRow?.meta ?? ""]
                .filter(Boolean)
                .join(" · ") || null
            }
            sitting={asSitting(hero)}
          />
        ) : null}

        {view.sections.map((section) => {
          const rest = section.items.filter((i) => i !== hero);
          if (!rest.length) return null;
          return (
            <View key={section.kind} testID={`playingSection-${section.kind}`}>
              <SectionTitle count={section.kind === "yourTurn" ? rest.length : undefined}>
                {TITLES[section.kind]}
              </SectionTitle>
              {sectionWhere(rest) ? (
                <Text style={styles.sectionWhere}>{sectionWhere(rest)}</Text>
              ) : null}
              {rest.map((item) => {
                const game = find(item.appId);
                const row = rows.get(item.instanceId);
                // A game the catalogue no longer has can't be opened, so it isn't offered.
                if (!game || !row) return null;
                return (
                  <SittingCard
                    key={item.instanceId}
                    testID={`playingItem-${item.instanceId}`}
                    row={row}
                    game={game}
                    sitting={asSitting(item)}
                    showWhere={!sectionWhere(rest)}
                    live={liveName ? { name: liveName, tvName: tvName ?? "the TV" } : null}
                  />
                );
              })}
            </View>
          );
        })}

        {inProgress ? null : (
          <View testID="playingEmpty">
            {start.kind === "suggest" ? (
              <>
                <Text style={styles.lead}>{start.lead}</Text>
                <Text style={styles.sub}>{start.sub}</Text>
                {start.offerCast ? (
                  <Button
                    testID="playingCast"
                    label="Cast to TV"
                    style={styles.cast}
                    onPress={toTv}
                  />
                ) : null}
              </>
            ) : (
              <PlayingNotice
                kind={start.kind}
                error={start.kind === "offline" ? start.error : null}
                onRetry={retry}
                onLibrary={() => router.navigate("/library")}
              />
            )}
          </View>
        )}

        {start.kind === "suggest" ? (
          <StartTonight
            title={inProgress ? "Start something new" : "Try tonight"}
            picks={start.picks}
            big={!inProgress}
            startPrimary={!inProgress && !start.offerCast}
          />
        ) : null}
      </Screen>
      {/* Content scrolls under the status bar on a dusk band, never against the clock. */}
      <View style={[styles.statusBand, { height: insets.top }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dusk0 },
  statusBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.dusk0,
  },
  lead: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  sub: { color: colors.cream2, fontSize: 17, lineHeight: 24, marginTop: 6 },
  cast: { marginTop: 18 },
  sectionWhere: {
    color: colors.lilac,
    fontSize: 14,
    fontWeight: "700",
    marginTop: -4,
    marginBottom: 10,
  },
});
