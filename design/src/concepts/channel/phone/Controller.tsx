// In a segment, the phone is two things: the game's own controller (the game owns it) inside a thin
// director strip (the channel owns it). The strip is the remote: running order, cut, back.
import type { Store } from "../../../harness/store";
import { StatusBar } from "../brand/PhoneTop";
import { Bars } from "../brand/Mark";
import { segment, upNext } from "../programme";
import { goBack, go, type S } from "../state";
import { GrownupController } from "../games/registry";
import { CutProgress } from "./CutProgress";

export function Controller({ s, store }: { s: S; store: Store<S> }) {
  if (s.cut) return <CutProgress s={s} />;
  const now = segment(s.onAir);
  const nextId = s.next === s.onAir ? upNext(s.onAir)[0] ?? "story-nook" : s.next;
  const next = segment(nextId);
  const prev = s.prev ? segment(s.prev) : null;
  return (
    <div className="ch-phone ch-ctl">
      <StatusBar dark />
      <header className="ch-strip">
        <button className="ch-strip-home" data-bot="home" aria-label="Tonight" onClick={() => go(store, "home")}>
          <Bars height={18} width={5} gap={2} live />
        </button>
        <span className="ch-strip-now">
          <span className="ch-strip-tally">On air</span>
          <b>{now.game.name}</b>
        </span>
        <button className="ch-strip-next" data-bot="director" onClick={() => store.update((x) => ({ ...x, next: nextId, phone: "director" }))}>
          <small>Next</small>
          <b>{next.game.name}</b>
        </button>
      </header>
      {s.undoOpen && prev && (
        <div className="ch-notice ch-notice-undo">
          <span>
            <b>{prev.game.name} saved</b> at {prev.instance.title.split(" · ")[0]}
          </span>
          <button data-bot="undo" onClick={() => goBack(store)}>
            Back to it
          </button>
        </div>
      )}
      {s.avaNotice && (
        <div className="ch-notice ch-notice-warn" role="status">
          <span className="ch-batt" aria-hidden="true" />
          <span>
            <b>Ava's iPad is asleep (9%).</b> Her seat is saved. Plug it in and it joins as Ava by itself.
          </span>
          <button data-bot="ava-ok" onClick={() => store.update((x) => ({ ...x, avaNotice: false }))}>
            OK
          </button>
        </div>
      )}
      <div className="ch-game-frame">
        <GrownupController gameId={s.onAir} store={store} />
      </div>
    </div>
  );
}
