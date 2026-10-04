// Every game with turns, one list, in the one bucket rule (status.ts): Your turn · Coming up ·
// Their turn · Paused · Finished. Each game sits in exactly one bucket.
import type { Store } from "../../../harness/store";
import { everyGame } from "../inbox";
import { goHome, type S } from "../state";
import { BUCKET_TITLE, type Bucket } from "../status";
import { StatusBar } from "../ui/Brand";
import { Chevron } from "../ui/Icons";
import { Lane } from "../ui/Lane";
import { TurnRows } from "./TurnRows";

const ORDER: Bucket[] = ["tv", "yours", "coming", "theirs", "paused", "done"];
const EMPTY: Partial<Record<Bucket, string>> = { yours: "Nobody is waiting on you. We'll tell you when someone moves." };

export function Inbox({ s, store }: { s: S; store: Store<S> }) {
  const all = everyGame(s);
  return (
    <div className={`cx-phone ${s.textScale > 1 ? "cx-phone--dt" : ""}`}>
      <StatusBar dark />
      <div className="cx-topbar">
        <button className="cx-back" data-bot="inbox-home" onClick={() => store.update(goHome)}>
          <Chevron size={20} dir="left" /> Home
        </button>
      </div>
      <div className="cx-scroll">
        <h1 className="cx-title cx-title--page">All turns</h1>
        <p className="cx-lede">Word Duel and game nights, by who has to move.</p>
        {ORDER.filter((b) => all[b].length > 0 || EMPTY[b]).map((b) => (
          <Lane key={b} id={`bucket-${b}`} title={BUCKET_TITLE[b]} count={b === "yours" ? all[b].length : undefined}>
            <TurnRows items={all[b]} store={store} empty={EMPTY[b]} quiet={b === "done"} />
          </Lane>
        ))}
      </div>
    </div>
  );
}
