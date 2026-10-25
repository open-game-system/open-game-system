import { reportOgsRoom, reportOgsSitting } from "@open-game-system/profile-kit";
import { useOgsSession } from "@open-game-system/profile-kit/react";
import { useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GAME } from "../game.config";
import { COLORS } from "../game/rules";
import { RoomContext } from "../room.context";
import type { Boot, PublicView } from "../room.types";
import { sfx, unlockAudio } from "./audio";
import { readBoot } from "./boot";
import { PAINT } from "./colors";
import { useSecondsLeft, useTickAfter } from "./deadline";
import { Kites } from "./kites";
import { startClientLog } from "./log";

const boot = readBoot();
const log = startClientLog("tv", boot.roomCode);
// Nobody can tap a TV: start sound at once (the launcher frame and the AirPlay window allow autoplay).
unlockAudio();
// Framed by the OGS launcher: say which room this TV shows, so the couch's phones follow into it.
reportOgsRoom(boot.roomCode);

/** The focal area the game rig keeps clear of overlays (game-rig check). */
Reflect.set(window, "__focalRect", () => ({ x: 0, y: 140, w: 1920, h: 800 }));

function TvApp({ boot }: { boot: Boot }) {
  const view = RoomContext.useSelector((s) => s.public);
  const send = RoomContext.useSend();
  // On an OGS TV (the launcher, or this game's own app on AirPlay/Chromecast) OGS shows who is
  // here and how to join; a plain browser TV shows the join link itself.
  const session = useOgsSession();
  const onOgsTv = session !== null;

  useEffect(() => {
    log({ name: "tv.phase", data: { phase: view.phase, round: view.round } });
    if (view.phase === "show") sfx.start();
    if (view.phase === "reveal") sfx.reveal();
  }, [view.phase, view.round]);

  useEffect(() => {
    if (!session) return;
    const status = view.phase === "lobby" ? "lobby" : view.phase === "over" ? "completed" : "active";
    reportOgsSitting({ instanceId: session.instanceId, appId: GAME.appId, status, title: titleOf(view) });
  }, [session, view.phase, view.round]);

  useTickAfter(view.endsAt, useCallback(() => send({ type: "TICK" }), [send]));

  return (
    <main className={`tv phase-${view.phase}`}>
      <header className="tv-top">
        <h1>{GAME.name}</h1>
        {view.phase !== "lobby" && view.phase !== "over" && (
          <p className="round">
            Round {view.round + 1} of {view.rounds}
          </p>
        )}
      </header>
      {view.phase === "lobby" && <Lobby view={view} joinUrl={onOgsTv ? null : boot.joinUrl} />}
      {view.phase === "show" && <Kites shapes={view.shapes} />}
      {view.phase === "answer" && <Answer view={view} />}
      {view.phase === "reveal" && <Reveal view={view} />}
      {view.phase === "over" && <Over view={view} />}
      <Scores view={view} />
    </main>
  );
}

function titleOf(view: PublicView): string {
  if (view.phase === "lobby") return "In the lobby";
  if (view.phase === "over") return `Won by ${view.winners.join(" & ")}`;
  return `Round ${view.round + 1} of ${view.rounds}`;
}

function Lobby({ view, joinUrl }: { view: PublicView; joinUrl: string | null }) {
  return (
    <section className="tv-center">
      <p className="lead">Watch the kites. Which color flies the most?</p>
      {joinUrl && (
        <p className="join">
          Join on your phone: <strong>{joinUrl}</strong>
        </p>
      )}
      <p className="hint">{view.players.length === 0 ? "Waiting for the first phone…" : "The first phone starts the game."}</p>
    </section>
  );
}

function Answer({ view }: { view: PublicView }) {
  const left = useSecondsLeft(view.endsAt);
  return (
    <section className="tv-center">
      <p className="lead">Which color had the most kites?</p>
      <p className="clock" aria-label="seconds left">
        {left}
      </p>
    </section>
  );
}

function Reveal({ view }: { view: PublicView }) {
  const reveal = view.reveal;
  if (!reveal) return null;
  const top = Math.max(...COLORS.map((c) => reveal.counts[c]));
  return (
    <section className="tv-center">
      <div className="bars">
        {COLORS.map((c) => (
          <div key={c} className={`bar ${c === reveal.answer ? "win" : ""}`}>
            <div className="fill" style={{ height: `${((reveal.counts[c]) / top) * 100}%`, background: PAINT[c].fill }} />
            <span className="count">{reveal.counts[c]}</span>
            <span className="label">{PAINT[c].label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Over({ view }: { view: PublicView }) {
  return (
    <section className="tv-center">
      <p className="lead">{view.winners.length > 0 ? `${view.winners.join(" & ")} wins!` : "Game over"}</p>
      <p className="hint">The first phone can start another game.</p>
    </section>
  );
}

function Scores({ view }: { view: PublicView }) {
  if (view.players.length === 0) return null;
  return (
    <footer className="scores">
      {view.players.map((p) => (
        <span key={p.seat} className={`chip ${p.answered ? "answered" : ""} ${p.correct === true ? "right" : ""}`}>
          {p.name} <b>{p.score}</b>
        </span>
      ))}
    </footer>
  );
}

const root = document.getElementById("app");
if (!root) throw new Error("tv.html has no #app");
createRoot(root).render(
  <RoomContext.Provider
    host={boot.host}
    actorId={boot.roomCode}
    accessToken={boot.accessToken}
    checksum={boot.checksum}
    initialSnapshot={boot.snapshot}
  >
    <TvApp boot={boot} />
  </RoomContext.Provider>,
);
