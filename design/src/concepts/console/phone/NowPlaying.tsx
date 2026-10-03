// The console's "now playing" card: what the TV is showing and who is here. When the TV is on the
// console home, this card mirrors the TV's focus and is the remote's Play button.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { activities } from "../activities";
import { PRESENT, resumePoint, type S } from "../state";
import { Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { TvIcon } from "../ui/Icons";

export function NowPlaying({ s, store }: { s: S; store: Store<S> }) {
  const playing = s.onTv;
  const focusId = playing ?? s.tvFocus;
  const game = gameById(focusId);
  const focusAct = activities(s).find((a) => a.gameId === focusId);
  const canPlay = game.shape === "couch";
  const act = () => store.update((x) => (x.onTv ? { ...x, phone: "controller" } : canPlay ? { ...x, onTv: x.tvFocus, phone: "controller" } : x));
  return (
    <section className={`cx-now ${playing ? "" : "cx-now--idle"}`}>
      <div className="cx-now__art" key={focusId}>
        <GameArt gameId={focusId} />
      </div>
      <div className="cx-now__body">
        <div className="cx-now__where">
          <span className="cx-live-dot" />
          <TvIcon size={16} />
          {playing ? "Living room TV" : "On the TV: console home"}
        </div>
        <div className="cx-now__game">{game.name}</div>
        <div className="cx-now__point">{playing ? `${resumePoint(focusId)} · in progress` : (focusAct?.title ?? game.tagline)}</div>
        <div className="cx-now__who">
          {PRESENT.map((p) => (
            <Portrait key={p.id} person={p} size={26} />
          ))}
          <span>3 here tonight</span>
        </div>
      </div>
      {(playing || canPlay) && (
        <button className="cx-btn cx-btn--primary cx-now__cta" data-bot={playing ? "open-controller" : "play-on-tv"} onClick={act}>
          <span>{playing ? "Controller" : "Play on TV"}</span>
        </button>
      )}
    </section>
  );
}
