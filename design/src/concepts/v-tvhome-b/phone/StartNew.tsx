// Continue or New (flow 4). Continue is the hero's main button (the save picks up where it
// stopped). New opens this sheet, which says what happens to the old save BEFORE anything starts:
// kept as a second save you can go back to (the default), or replaced for good.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { closeStartNew, saveOf, setFate, startNew, type S } from "../state";
import { GameArt } from "../ui/GameArt";
import { Close } from "../ui/Icons";

function Option({ on, bot, title, body, onPick, warn = false }: { on: boolean; bot: string; title: string; body: string; onPick: () => void; warn?: boolean }) {
  return (
    <button className={`cx-choice cn-option ${on ? "is-on" : ""} ${warn ? "cn-option--warn" : ""}`} role="radio" aria-checked={on} data-bot={bot} onClick={onPick}>
      <span className="cn-option__dot" aria-hidden />
      <span>
        <b>{title}</b>
        <span>{body}</span>
      </span>
    </button>
  );
}

export function StartNewSheet({ s, store }: { s: S; store: Store<S> }) {
  const st = s.start;
  if (!st) return null;
  const g = gameById(st.gameId);
  const save = saveOf(st.gameId);
  const close = () => store.update(closeStartNew);
  const point = save?.point.toLowerCase() ?? "your save";
  return (
    <div className="cx-sheetwrap">
      <button className="cx-scrim" aria-label="Close" onClick={close} />
      <div className="cx-sheet cx-sheet--dark" role="dialog" aria-label={`Start a new ${g.name}`}>
        <div className="cx-sheet__grab" />
        <div className="cx-preview__head">
          <h3 className="cx-who__h">Start {g.name} new?</h3>
          <button className="cx-iconbtn" data-bot="new-close" aria-label="Close" onClick={close}>
            <Close size={20} />
          </button>
        </div>
        {save && (
          <div className="cn-save">
            <span className="cn-save__art"><GameArt gameId={g.id} alt /></span>
            <span>
              <b>Your save: {save.summary}</b>
              <span>Saved {save.when}. What happens to it?</span>
            </span>
          </div>
        )}
        <div className="cn-options" role="radiogroup" aria-label={`What happens to ${point}`}>
          <Option on={st.fate === "keep"} bot="fate-keep" title={`Keep ${point} as a second save`} body={`Go back to it any time: ${g.name}'s Continue lists both.`} onPick={() => store.update((x) => setFate(x, "keep"))} />
          <Option on={st.fate === "replace"} bot="fate-replace" warn title={`Replace ${point}`} body={`${save?.summary ?? "The old save"} is gone for good. This can't be undone.`} onPick={() => store.update((x) => setFate(x, "replace"))} />
        </div>
        <button className="cx-btn cx-btn--light cx-wide cn-go" data-bot="new-confirm" onClick={() => store.update(startNew)}>
          <span>{st.fate === "keep" ? `Start new · keep ${point}` : `Start new · replace ${point}`}</span>
        </button>
      </div>
    </div>
  );
}
