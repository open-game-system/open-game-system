import type { Manifest, SessionState } from "@open-game-system/ogs-protocol";
import {
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Boot } from "../boot";
import { firstFocus, locate, move } from "../launcher/focus-grid";
import { buildRows, focusRows } from "../launcher/layout";
import { nameForDevice, phoneOf } from "../launcher/people";
import type { Connection, SessionClient } from "../session/client";
import type { LauncherData } from "../session/data";
import { Assembling } from "./Assembling";
import { GamePage } from "./GamePage";
import { Home } from "./Home";
import { Player } from "./Player";
import { Stage } from "./Stage";
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
  if (!snap.state) return <Assembling household={data.household} />;
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
  const rows = useMemo(
    () =>
      buildRows({ games: data.games, instances: data.instances, suspended: state.suspended, now }),
    [data, state.suspended, now],
  );
  const grid = useMemo(() => focusRows(rows), [rows]);

  // The launcher owns its layout: a remote press arrives as focus.move, the ring's new place goes back.
  const onMove = useEffectEvent((dir: "up" | "down" | "left" | "right") => {
    if (state.screen !== "home") return;
    const next = move(grid, state.focus, dir);
    if (next && next !== state.focus) client.send({ type: "focus.set", itemId: next });
  });
  useEffect(() => client.onFocusMove((d) => onMove(d)), [client]);

  const sentInitial = useRef<string | null>(null);
  useEffect(() => {
    if (state.screen !== "home" || connection !== "open" || locate(grid, state.focus)) return;
    const first = firstFocus(grid);
    if (first && sentInitial.current !== `${state.focus}->${first}`) {
      sentInitial.current = `${state.focus}->${first}`;
      client.send({ type: "focus.set", itemId: first });
    }
  }, [state.screen, state.focus, grid, connection, client]);

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
  const pageGame = state.page ? games.get(state.page) : undefined;
  const remoteHolder = nameForDevice(state, data.household, state.remote);

  return (
    <div className="launcher" data-screen={state.screen} data-connection={connection}>
      <Home
        rows={rows}
        focus={state.focus}
        household={data.household}
        remoteHolder={remoteHolder}
        now={now}
      />
      {state.screen === "game-page" && pageGame && (
        <GamePage
          game={pageGame}
          state={state}
          household={data.household}
          remoteHolder={remoteHolder}
          now={now}
        />
      )}
      <Player
        screen={state.screen}
        game={currentGame ?? lastGame.current}
        hostPhone={phoneOf(state, data.household, state.current?.hostDeviceId ?? null)}
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
