import { isOGSCastAvailable } from "@open-game-system/cast-kit-core";
import { CastButton, CastProvider, CastStatus, useCastViewUrl } from "@open-game-system/cast-kit-react";
import { reportOgsSitting } from "@open-game-system/profile-kit";
import { useOgsProfile } from "@open-game-system/profile-kit/react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GAME } from "../game.config";
import { type Color, COLORS } from "../game/rules";
import { RoomContext } from "../room.context";
import { PrivateViewSchema } from "../room.schemas";
import type { Boot, PublicView } from "../room.types";
import { sfx, unlockAudio } from "./audio";
import { readBoot } from "./boot";
import { PAINT } from "./colors";
import { useSecondsLeft, useTickAfter } from "./deadline";
import { startClientLog } from "./log";
import { phoneHost } from "./phone-host";

const boot = readBoot();
const log = startClientLog("phone", boot.roomCode);
const where = phoneHost({ bridge: isOGSCastAvailable(), userAgent: navigator.userAgent, appId: GAME.appId });
log({ name: "phone.boot", data: { where } });

/** Inside an app (OGS or our own): hand this room's TV page to the cast (the app's TV, any kind). */
function DeclareTvPage({ tvUrl }: { tvUrl: string }) {
  useCastViewUrl(tvUrl);
  return null;
}

/**
 * Our own app only: the shell's TV picker (Apple TV / AirPlay, Chromecasts, a browser TV). The OGS
 * app casts every game from its own TV tab, so the button never shows there.
 */
function ShowOnTv() {
  return (
    <div className="cast">
      <CastButton>
        {({ status, deviceName }, { showPicker, stopCasting }) =>
          status === "connected" ? (
            <button type="button" className="secondary" onClick={stopCasting} data-testid="stopTv">
              On {deviceName ?? "the TV"} · Stop
            </button>
          ) : (
            <button type="button" className="secondary" onClick={showPicker} disabled={status === "connecting"} data-testid="showOnTv">
              {status === "connecting" ? "Connecting…" : "Show on TV"}
            </button>
          )
        }
      </CastButton>
      <CastStatus>{({ error }) => (error ? <p role="alert">{error}</p> : null)}</CastStatus>
    </div>
  );
}

function PhoneApp({ boot }: { boot: Boot }) {
  const view = RoomContext.useSelector((s) => s.public);
  const me = RoomContext.useSelector((s) => PrivateViewSchema.parse(s.private));
  const send = RoomContext.useSend();
  useTickAfter(view.endsAt, useCallback(() => send({ type: "TICK" }), [send]));

  useEffect(() => {
    if (where === "browser") return;
    const status = view.phase === "lobby" ? "lobby" : view.phase === "over" ? "completed" : "active";
    reportOgsSitting({ instanceId: `${GAME.appId}-${view.roomCode}`, appId: GAME.appId, status, title: GAME.name });
  }, [view.phase, view.roomCode]);

  const seated = "role" in me && me.role === "player" ? me : null;
  return (
    <main className={`phone phase-${view.phase}`}>
      {!seated ? (
        <JoinGate />
      ) : view.phase === "lobby" || view.phase === "over" ? (
        <Lobby view={view} host={seated.host} boot={boot} />
      ) : view.phase === "answer" ? (
        <Pick picked={seated.pick} endsAt={view.endsAt} />
      ) : view.phase === "reveal" ? (
        <Result view={view} seat={seated.seat} />
      ) : (
        <p className="big-note">Watch the TV!</p>
      )}
    </main>
  );
}

/**
 * Who is this? In an app with an OGS profile: join at once under its name (the Room verifies the
 * token). In a plain browser (profile null): ask for a name. `undefined`: still asking the app.
 */
function JoinGate() {
  const profile = useOgsProfile();
  const send = RoomContext.useSend();
  const asked = useRef(false);
  useEffect(() => {
    if (!profile || asked.current) return;
    asked.current = true;
    send({ type: "JOIN", name: profile.name, ogsToken: profile.token });
  }, [profile, send]);
  if (profile !== null) return <p className="big-note">Joining…</p>;
  return <NameForm />;
}

function NameForm() {
  const send = RoomContext.useSend();
  const [name, setName] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    send({ type: "JOIN", name });
  };
  return (
    <form className="name-form" onSubmit={submit}>
      <h1>{GAME.name}</h1>
      <label htmlFor="name">Your name</label>
      <input id="name" data-testid="nameField" value={name} maxLength={16} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="primary" data-testid="joinButton">
        Join
      </button>
    </form>
  );
}

function Lobby({ view, host, boot }: { view: PublicView; host: boolean; boot: Boot }) {
  const send = RoomContext.useSend();
  const start = () => {
    unlockAudio();
    sfx.start();
    send({ type: "START" });
  };
  return (
    <section className="lobby">
      <h1>{GAME.name}</h1>
      {view.phase === "over" && <p className="lead">{view.winners.join(" & ")} wins!</p>}
      <ul className="players">
        {view.players.map((p) => (
          <li key={p.seat}>
            {p.name} <b>{p.score}</b>
          </li>
        ))}
      </ul>
      {where === "own-app" && <ShowOnTv />}
      {where === "browser" && (
        <p className="hint">
          TV: open <a href={boot.tvUrl}>this room's TV page</a> on a laptop or TV browser. Friends join with code{" "}
          <b>{view.roomCode}</b> at {new URL(boot.joinUrl).host}/join/{view.roomCode}
        </p>
      )}
      {host ? (
        <button type="button" className="primary" onClick={start} data-testid="startButton">
          {view.phase === "over" ? "Play again" : "Start"}
        </button>
      ) : (
        <p className="hint">The first player starts the game.</p>
      )}
    </section>
  );
}

function Pick({ picked, endsAt }: { picked: Color | null; endsAt: number | null }) {
  const send = RoomContext.useSend();
  const left = useSecondsLeft(endsAt);
  const choose = (color: Color) => {
    unlockAudio();
    sfx.pick(color);
    send({ type: "PICK", color });
  };
  return (
    <section className="pick">
      <p className="lead">Which color had the most? {left !== null && <span className="left">{left}</span>}</p>
      <div className="grid">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${picked === c ? "chosen" : ""}`}
            style={{ background: PAINT[c].fill }}
            disabled={picked !== null}
            onClick={() => choose(c)}
            aria-label={PAINT[c].label}
            data-testid={`pick-${c}`}
          >
            {PAINT[c].label}
          </button>
        ))}
      </div>
    </section>
  );
}

function Result({ view, seat }: { view: PublicView; seat: string }) {
  const me = view.players.find((p) => p.seat === seat);
  const answer = view.reveal?.answer;
  useEffect(() => {
    if (me?.correct) sfx.reveal();
    else sfx.buzz();
  }, [me?.correct]);
  return (
    <section className="result">
      <p className="big-note">{me?.correct ? "Got it!" : "Not this time"}</p>
      {answer && <p className="lead">It was {PAINT[answer].label}.</p>}
      <p className="hint">Score: {me?.score ?? 0}</p>
    </section>
  );
}

function Root({ boot }: { boot: Boot }) {
  const app = useMemo(
    () => (
      <RoomContext.Provider
        host={boot.host}
        actorId={boot.roomCode}
        accessToken={boot.accessToken}
        checksum={boot.checksum}
        initialSnapshot={boot.snapshot}
      >
        <PhoneApp boot={boot} />
      </RoomContext.Provider>
    ),
    [boot],
  );
  if (where === "browser") return app;
  // CastProvider renders nothing until the app sends its cast state: only our own app's button
  // needs it around the page; elsewhere it sits beside it and only declares the TV page.
  return where === "own-app" ? (
    <CastProvider>
      <DeclareTvPage tvUrl={boot.tvUrl} />
      {app}
    </CastProvider>
  ) : (
    <>
      <CastProvider>
        <DeclareTvPage tvUrl={boot.tvUrl} />
      </CastProvider>
      {app}
    </>
  );
}

const root = document.getElementById("app");
if (!root) throw new Error("phone.html has no #app");
createRoot(root).render(<Root boot={boot} />);
