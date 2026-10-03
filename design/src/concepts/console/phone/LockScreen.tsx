// A push on the grown-up's lock screen (pushes never go to a kid's device). One push per game that
// needs you, grouped under OGS; tapping it lands on that game's move, not on a home screen.
import type { Store } from "../../../harness/store";
import type { S } from "../state";
import { Mark } from "../ui/Brand";
import { Lock } from "../ui/Icons";
import { openTurn } from "./TurnRows";

export function LockScreen({ s, store }: { s: S; store: Store<S> }) {
  const p = s.push;
  return (
    <div className="cx-lock">
      <img className="cx-lock__wall" src="/art/hearthisle/dusk.jpg" alt="" />
      <div className="cx-lock__top">
        <Lock size={18} />
        <span className="cx-lock__time">7:10</span>
        <span className="cx-lock__date">Friday 3 October</span>
      </div>
      {p && (
        <div className="cx-lock__stack">
          <button className="cx-push" data-bot="push-open" onClick={() => store.update((x) => openTurn(x, p.open))}>
            <span className="cx-push__app">
              <span className="cx-push__icon">
                <Mark size={16} color="#fff" />
              </span>
              OGS
              <span className="cx-push__when">now</span>
            </span>
            <b>{p.title}</b>
            <span>{p.body}</span>
          </button>
          {p.more.length > 0 && (
            <div className="cx-push cx-push--more" aria-label={`${p.more.length} more from OGS`}>
              {p.more.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
