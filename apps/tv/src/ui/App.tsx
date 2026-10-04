import type { ClientMessage, Manifest, SessionState } from "@open-game-system/ogs-protocol";
import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Boot } from "../boot";
import { buildHome, homeFocusRows, homeMove, recoverFocus } from "../launcher/home";
import { nameForDevice, phoneOf, playersOf } from "../launcher/people";
import { pageMove, readShortcut, shortcutStart } from "../launcher/shortcuts";
import type { Connection, SessionClient } from "../session/client";
import type { LauncherData } from "../session/data";
import { Assembling } from "./Assembling";
import { GamePage } from "./GamePage";
import { Home } from "./Home";
import { Player } from "./Player";
import { Stage } from "./Stage";
import { Surprise } from "./Surprise";
import { useFrames } from "./useFrames";
import { useNow } from "./useNow";

export function App({ boot }: { boot: Boot }) {
  return (
    <Stage>
      <Suspense fallback={<Assembling />}>
        <Launcher boot={boot} />
      </Suspense>
    </Stage>
  );
}

function Launcher({ boot }: { boot: Boot }) {
  const data = use(boot.data);
  const snap = useSyncExternalStore(boot.client.subscribe, boot.client.getSnapshot);
  if (!snap.state) return <Assembling session={data.session} />;
  return (
    <Living
      client={boot.client}
      state={snap.state}
      connection={snap.connection}
      data={data}
      frameTimeoutMs={boot.frameTimeoutMs}
    />
  );
}

const KEYS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function Living(props: {
  client: SessionClient;
  state: SessionState;
  connection: Connection;
  data: LauncherData;
  frameTimeoutMs: number;
}) {
  const { client, data } = props;
  const { state, connection } = props;
  const now = useNow();
  const games = useMemo(() => new Map(data.games.map((g) => [g.appId, g])), [data.games]);
  const home = useMemo(
    () =>
      buildHome({ games: data.games, instances: data.instances, suspended: state.suspended, now }),
    [data, state.suspended, now],
  );
  const grid = useMemo(() => homeFocusRows(home), [home]);
  const pageGame = state.page ? games.get(state.page) : undefined;
  const shortcut = state.screen === "game-page" ? readShortcut(state.page) : null;

  // The launcher owns its layout: a remote press arrives as focus.move, the ring's new place goes back.
  const onMove = useEffectEvent((dir: "up" | "down" | "left" | "right") => {
    const next =
      state.screen === "home"
        ? homeMove(grid, state.focus, dir, lastIcon.current)
        : state.screen === "game-page" && pageGame
          ? pageMove(
              state.focus,
              dir,
              state.suspended.some((g) => g.appId === pageGame.appId),
            )
          : null;
    if (next && next !== state.focus) client.send({ type: "focus.set", itemId: next });
  });
  useEffect(() => client.onFocusMove((d) => onMove(d)), [client]);

  // The last icon the ring was on: up from the cards returns there.
  const lastIcon = useRef<string | null>(null);
  if (grid[0]?.items.includes(state.focus ?? "")) lastIcon.current = state.focus;
  // Back from a game's page the ring returns to that game's icon.
  const lastPage = useRef<string | null>(null);
  if (pageGame) lastPage.current = pageGame.appId;
  const sentInitial = useRef<string | null>(null);
  useEffect(() => {
    if (state.screen !== "home" || connection !== "open") return;
    const next = recoverFocus(grid, state.focus, lastPage.current);
    if (next && sentInitial.current !== `${state.focus}->${next}`) {
      sentInitial.current = `${state.focus}->${next}`;
      client.send({ type: "focus.set", itemId: next });
    }
  }, [state.screen, state.focus, grid, connection, client]);

  // A sitting card opened: continue that sitting at once (the Surprise card spins first).
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (shortcut?.kind !== "continue" || connection !== "open") return;
    if (startedFor.current === state.page) return;
    startedFor.current = state.page;
    const msg = shortcutStart(shortcut, {
      surprise: null,
      suspended: state.suspended,
      remote: state.remote,
    });
    if (msg) client.send(msg);
  }, [shortcut, state.page, state.suspended, state.remote, connection, client]);
  if (state.screen !== "game-page") startedFor.current = null;
  const startSurprise = useCallback(
    (appId: string) =>
      shortcutStart(
        { kind: "surprise" },
        { surprise: appId, suspended: state.suspended, remote: state.remote },
      ),
    [state.suspended, state.remote],
  );
  const send = useCallback((m: ClientMessage) => client.send(m), [client]);
  const surpriseCard = home.cards.find((c) => c.kind === "surprise");
  const surprisePool = surpriseCard?.kind === "surprise" ? surpriseCard.pool : [];
  const playersFor = useCallback((appId: string) => playersOf(state, appId), [state]);

  // A keyboard drives the session the way the phone's remote does (development; a TV has none).
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const dir = KEYS[e.key];
    if (dir) client.send({ type: "focus.move", dir });
    else if (e.key === "Enter")
      client.send({ type: "select", deviceId: state.remote ?? "tv-keys" });
    else if (e.key === "Escape" || e.key === "Backspace") client.send({ type: "back" });
    else if (e.key === "h") client.send({ type: "home" });
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const frames = useFrames(client, state.current, props.frameTimeoutMs);
  const lastGame = useRef<Manifest | null>(null);
  const currentGame = state.current ? (games.get(state.current.appId) ?? null) : null;
  if (currentGame) lastGame.current = currentGame;
  const remoteHolder = nameForDevice(state, state.remote);

  return (
    <div className="launcher" data-screen={state.screen} data-connection={connection}>
      <Home
        home={home}
        focus={state.focus}
        session={data.session}
        members={state.members}
        playersOf={playersFor}
        remoteHolder={remoteHolder}
        now={now}
      />
      {state.screen === "game-page" && pageGame && (
        <GamePage game={pageGame} state={state} remoteHolder={remoteHolder} now={now} />
      )}
      {shortcut?.kind === "surprise" && (
        <Surprise
          icons={home.icons.filter((i) => surprisePool.includes(i.appId))}
          recent={state.suspended[0]?.appId ?? null}
          start={startSurprise}
          send={send}
        />
      )}
      <Player
        screen={state.screen}
        game={currentGame ?? lastGame.current}
        hostPhone={phoneOf(state, state.current?.hostDeviceId ?? null)}
        remoteHolder={remoteHolder}
        frames={frames}
      />
      {connection === "reconnecting" && (
        <div className="connection-chip" data-testid="reconnecting">
          <span className="pulse" />
          Reconnecting to the phones
        </div>
      )}
    </div>
  );
}
