// A turn arriving: one calm push to the grown-up's phone, in the household's voice. Kids' iPads
// never get one. Tapping it opens that exact game.
import type { Store } from "../../../harness/store";
import { Lamp } from "../ui/Icons";
import { TileWord } from "./Noticeboard";
import type { S } from "../state";

export function Lock({ s, store }: { s: S; store: Store<S> }) {
  return (
    <div className="pl pl-lock">
      <p className="pl-lock-date">Friday, October 3</p>
      <p className="pl-lock-time">{s.clock}</p>
      <button className="pl-push" data-bot="push-nana" onClick={() => store.update((x) => ({ ...x, phone: "duel", openDuel: "wd-1", placed: [], sent: false }))}>
        <span className="pl-push-app">
          <span className="pl-push-icon">
            <Lamp size={22} />
          </span>
          <span>Porchlight · Word Duel</span>
          <span className="pl-push-when">now</span>
        </span>
        <span className="pl-push-body">
          <span>
            <b>Nana played QUILT for 34</b>
            <span>Your move. Mom's game is waiting too.</span>
          </span>
          <TileWord word="QUILT" />
        </span>
      </button>
    </div>
  );
}
