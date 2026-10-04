// Up next: this household's couch games, as a short stack under the thumb. With a game on the TV,
// one tap swaps to it (the current game saves itself; undo is one tap after). On the console home,
// one tap puts it on the TV's big tile, and the deck's middle key plays it.
import type { Store } from "../../../../harness/store";
import { gameById } from "../../../../world";
import { couchShelf } from "../../activities";
import { pickActivity, type S } from "../../state";
import { Chip } from "../../ui/Chip";
import { GameArt } from "../../ui/GameArt";
import { SwapKey } from "./keys";
import { TvIcon } from "../../ui/Icons";

export function UpNext({ s, store }: { s: S; store: Store<S> }) {
  const shelf = couchShelf(s).filter((a) => a.gameId !== (s.onTv ?? s.tvFocus));
  const playing = !!s.onTv;
  return (
    <section className="rm-next" aria-label="Up next">
      <h2 className="rm-h">{playing ? "Swap to" : "Show on the TV"}</h2>
      <ul className="rm-next__list">
        {shelf.slice(0, 2).map((a) => (
          <li key={a.id}>
            <button className="rm-next__row" data-bot={`act-${a.gameId}`} aria-label={`${playing ? "Swap to" : "Show"} ${gameById(a.gameId).name}`} onClick={() => store.update((x) => pickActivity(x, a.gameId))}>
              <span className="rm-next__art">
                <GameArt gameId={a.gameId} alt />
              </span>
              <span className="rm-next__text">
                <b>{gameById(a.gameId).name}</b>
                <Chip status={a.status} />
              </span>
              <span className="rm-next__go" aria-hidden>
                {playing ? <SwapKey size={20} /> : <TvIcon size={20} />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
