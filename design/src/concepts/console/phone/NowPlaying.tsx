// Lane 1, "On the TV tonight": the couch session. The hero is what the TV shows, with tonight's
// people stuck along its foot as stickers; the rail under it is this household's couch games, each
// with its status. "Continue" starts the focused game where its save stopped; "New" asks what
// happens to that save first (StartNew.tsx); "Controller" opens this phone's seat in the game on
// the TV. None of them ever means anything else.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { activities, couchShelf } from "../activities";
import { castAndPlay, hereTonight, openStartNew, pickActivity, pointIn, saveOf, type S } from "../state";
import { nightLine } from "../nights";
import { LIVE, READY } from "../status";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { Gamepad, TvIcon } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";

function Cta({ s, store }: { s: S; store: Store<S> }) {
  const playing = s.onTv;
  const focusId = playing ?? s.tvFocus;
  const canPlay = gameById(focusId).shape === "couch";
  const save = !playing && !s.fresh[focusId] ? saveOf(focusId) : null;
  const go = () =>
    store.update((x) => (x.onTv ? { ...x, phone: "controller" } : !canPlay ? x : x.cast === "off" ? castAndPlay(x, x.tvFocus) : { ...x, onTv: x.tvFocus, phone: "controller" }));
  if (!playing && !canPlay) return null;
  return (
    <div className="cx-now__ctas">
      <button className="cx-btn cx-btn--light cx-now__cta" data-bot={playing ? "open-controller" : "play-on-tv"} aria-label={save ? `Continue ${save.point.toLowerCase()} on the TV` : undefined} onClick={go}>
        {playing ? <Gamepad size={20} /> : <TvIcon size={20} />}
        <span>{playing ? "Controller" : save ? "Continue" : "Play on TV"}</span>
      </button>
      {save && (
        <button className="cx-btn cx-btn--line cx-now__new" data-bot="start-new" onClick={() => store.update((x) => openStartNew(x, focusId))}>
          <span>New</span>
        </button>
      )}
    </div>
  );
}

export function NowPlaying({ s, store }: { s: S; store: Store<S> }) {
  const playing = s.onTv;
  const focusId = playing ?? s.tvFocus;
  const game = gameById(focusId);
  const focusAct = activities(s).find((a) => a.gameId === focusId);
  const off = s.cast === "off";
  const here = hereTonight(s);
  const liveNight = s.nights.list.find((n) => n.status === "live" && n.gameId === playing);
  const point = liveNight ? nightLine(liveNight) : pointIn(s, focusId);
  const status = playing ? LIVE : (focusAct?.status ?? READY);
  const twoCtas = !playing && !s.fresh[focusId] && !!saveOf(focusId);
  return (
    <section className={`cx-now ${playing ? "" : "cx-now--idle"} ${twoCtas ? "cx-now--save" : ""}`}>
      <div className="cx-now__art" key={focusId}>
        <GameArt gameId={focusId} />
      </div>
      <div className="cx-now__body">
        <div className="cx-now__where">
          <Chip status={status} />
          <span>
            <TvIcon size={15} /> {playing ? "Living room TV" : off ? "TV off" : "Showing on the TV"}
          </span>
        </div>
        <div className="cx-now__game">{game.name}</div>
        <div className="cx-now__point">{playing ? point : (focusAct?.detail ?? game.tagline)}</div>
        <div className="cx-now__foot">
          <button className="cx-now__who" data-bot="couch-who" aria-label={`${here.length} here tonight. Change who's here`} onClick={() => store.update((x) => ({ ...x, who: true }))}>
            <span className="cx-now__stickers">
              {here.map((p) => (
                <Sticker key={p.id} person={p} size={40} />
              ))}
            </span>
            <span className="cx-now__count">{here.length} here</span>
          </button>
          <Cta s={s} store={store} />
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
