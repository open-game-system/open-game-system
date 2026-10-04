// Lane 1, "On the TV tonight": the couch session. The hero is what the TV shows; the rail under it
// is this household's couch games, each with its status. On the phone the TV is always the
// subject: "Play on TV" starts the focused game on the TV; "Controller" opens this phone's seat in
// the game already on the TV. Neither ever means anything else.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { activities, couchShelf } from "../activities";
import { castAndPlay, hereTonight, pickActivity, resumePoint, type S } from "../state";
import { nightLine } from "../nights";
import { LIVE, READY } from "../status";
import { Portrait } from "../ui/Brand";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { Gamepad, TvIcon } from "../ui/Icons";

export function NowPlaying({ s, store }: { s: S; store: Store<S> }) {
  const playing = s.onTv;
  const focusId = playing ?? s.tvFocus;
  const game = gameById(focusId);
  const focusAct = activities(s).find((a) => a.gameId === focusId);
  const canPlay = game.shape === "couch";
  const act = () =>
    store.update((x) => (x.onTv ? { ...x, phone: "controller" } : !canPlay ? x : x.cast === "off" ? castAndPlay(x, x.tvFocus) : { ...x, onTv: x.tvFocus, phone: "controller" }));
  const off = s.cast === "off";
  const here = hereTonight(s);
  const liveNight = s.nights.list.find((n) => n.status === "live" && n.gameId === playing);
  const point = liveNight ? nightLine(liveNight) : resumePoint(focusId);
  const status = playing ? LIVE : (focusAct?.status ?? READY);
  return (
    <section className={`cx-now ${playing ? "" : "cx-now--idle"}`}>
      <div className="cx-now__art" key={focusId}>
        <GameArt gameId={focusId} />
      </div>
      <div className="cx-now__body">
        <div className="cx-now__where">
          <Chip status={status} />
          <span>
            <TvIcon size={15} /> {playing ? "Living room TV" : off ? "Living room TV · off" : "Showing on the TV"}
          </span>
        </div>
        <div className="cx-now__game">{game.name}</div>
        <div className="cx-now__point">{playing ? point : (focusAct?.detail ?? game.tagline)}</div>
        <div className="cx-now__foot">
          <button className="cx-now__who" data-bot="couch-who" aria-label={`${here.length} here tonight. Change who's here`} onClick={() => store.update((x) => ({ ...x, who: true }))}>
            {here.map((p) => (
              <Portrait key={p.id} person={p} size={28} />
            ))}
            <span>{here.length} here</span>
          </button>
          {(playing || canPlay) && (
            <button className="cx-btn cx-btn--light cx-now__cta" data-bot={playing ? "open-controller" : "play-on-tv"} onClick={act}>
              {playing ? <Gamepad size={20} /> : <TvIcon size={20} />}
              <span>{playing ? "Controller" : "Play on TV"}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** The couch rail: every couch game this household has, with its status. Tapping one with a game
 * on the TV switches to it; on the console home it moves the TV's focus. */
export function CouchRail({ s, store }: { s: S; store: Store<S> }) {
  const shelf = couchShelf(s).filter((a) => a.gameId !== (s.onTv ?? s.tvFocus));
  return (
    <ul className="cx-rail" aria-label="Couch games">
      {shelf.map((a) => (
        <li key={a.id}>
          <button className="cx-rail__tile" data-bot={`act-${a.gameId}`} onClick={() => store.update((x) => pickActivity(x, a.gameId))}>
            <span className="cx-rail__art">
              <GameArt gameId={a.gameId} alt />
            </span>
            <b>{gameById(a.gameId).name}</b>
            <Chip status={a.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
