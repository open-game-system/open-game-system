// "All": the waiting strip pulled up into a tall sheet; the remote shrinks to a mini bar above it,
// so the TV stays one tap away. Every game with turns, in the one bucket rule (status.ts): Your turn · Coming up ·
// Their turn · Paused · Finished. Each game sits in exactly one bucket.
import type { Store } from "../../../harness/store";
import { everyGame } from "../inbox";
import { goHome, type S } from "../state";
import { BUCKET_TITLE, type Bucket } from "../status";
import { Lane } from "../ui/Lane";
import { TurnRows } from "./TurnRows";
import { MiniRemote } from "./remote/Mini";

const ORDER: Bucket[] = ["tv", "yours", "coming", "theirs", "paused", "done"];
const EMPTY: Partial<Record<Bucket, string>> = { yours: "Nobody is waiting on you. We'll tell you when someone moves." };

export function Inbox({ s, store }: { s: S; store: Store<S> }) {
  const all = everyGame(s);
  return (
    <div className="rm-inbox">
      <MiniRemote s={s} store={store} />
      <div className="rm-inbox__sheet" role="dialog" aria-label="Every game with turns">
        <div className="cx-sheet__grab" />
        <header className="rm-inbox__head">
          <h1 className="rm-inbox__title">Every game</h1>
          <button className="rm-inbox__done" data-bot="inbox-home" onClick={() => store.update(goHome)}>
            Done
          </button>
        </header>
        <div className="rm-inbox__scroll">
          {ORDER.filter((b) => all[b].length > 0 || EMPTY[b]).map((b) => (
            <Lane key={b} id={`bucket-${b}`} title={BUCKET_TITLE[b]} count={b === "yours" ? all[b].length : undefined}>
              <TurnRows items={all[b]} store={store} empty={EMPTY[b]} quiet={b === "done"} />
            </Lane>
          ))}
        </div>
      </div>
    </div>
  );
}
