// The remote, shrunk to a bar while a sheet is up: what's on the TV and its play/pause key. Tapping
// the bar goes back to the full remote.
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { goHome, pointIn, togglePause, type S } from "../../state";
import { GameArt } from "../../ui/GameArt";
import { PauseKey, PlayKey } from "./keys";

export function MiniRemote({ s, store }: { s: S; store: Store<S> }) {
  const id = s.onTv ?? s.tvFocus;
  const playing = !!s.onTv && gameById(id).shape === "couch";
  return (
    <div className="rm-mini">
      <button className="rm-mini__back" data-bot="mini-remote" aria-label="Back to the remote" onClick={() => store.update(goHome)}>
        <span className="rm-mini__art">
          <GameArt gameId={id} alt />
        </span>
        <span className="rm-mini__text">
          <b>{gameById(id).name}</b>
          <span>{s.onTv ? `Living room TV · ${s.paused ? "paused" : pointIn(s, id)}` : "On the TV home"}</span>
        </span>
      </button>
      {playing && (
        <button className="rm-mini__key" data-bot="mini-pause" aria-label={s.paused ? "Resume" : "Pause"} onClick={() => store.update(togglePause)}>
          {s.paused ? <PlayKey size={22} /> : <PauseKey size={22} />}
        </button>
      )}
    </div>
  );
}
