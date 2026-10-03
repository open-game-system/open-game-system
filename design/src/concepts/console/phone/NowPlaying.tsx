// The console's "now playing" bar: what the TV is showing and who is on which device.
import { gameById } from "../../../world";
import { Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { TvIcon } from "../ui/Icons";
import { PRESENT, resumePoint } from "../state";

export function NowPlaying({ gameId, onOpen }: { gameId: string | null; onOpen: () => void }) {
  return (
    <section className="cx-now">
      <div className="cx-now__art">{gameId ? <GameArt gameId={gameId} /> : <div className="cx-now__idle" />}</div>
      <div className="cx-now__body">
        <div className="cx-now__where">
          <span className="cx-live-dot" />
          <TvIcon size={16} />
          Living room TV
        </div>
        <div className="cx-now__game">{gameId ? gameById(gameId).name : "Console home"}</div>
        <div className="cx-now__point">{gameId ? `${resumePoint(gameId)} · in progress` : "Pick something to play"}</div>
        <div className="cx-now__who">
          {PRESENT.map((p) => (
            <Portrait key={p.id} person={p} size={26} />
          ))}
          <span>3 here tonight</span>
        </div>
      </div>
      <button className="cx-btn cx-btn--primary cx-now__cta" data-bot="open-controller" onClick={onOpen}>
        <span>{gameId ? "Controller" : "Choose"}</span>
      </button>
    </section>
  );
}
