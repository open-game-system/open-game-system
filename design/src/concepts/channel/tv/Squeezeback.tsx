// While the old segment saves, the picture squeezes back like end credits and the next one is promoted.
import { RUNNING_ORDER, segment } from "../programme";
import type { S } from "../state";
import { Wordmark } from "../brand/Mark";

export function Squeezeback({ s }: { s: S }) {
  const from = segment(s.prev ?? s.onAir);
  const to = segment(s.next);
  return (
    <div className="ch-tv ch-squeeze">
      <div className="ch-squeeze-frame">
        <img src={from.game.art.tv} alt="" />
        <div className="ch-squeeze-saved">
          <span className="ch-saved-stamp"><span>Saved</span></span>
          <b>{from.game.name}</b>
          <span>{from.instance.title.split(" · ")[0]} · 2 of 3 stars</span>
        </div>
      </div>
      <aside className="ch-squeeze-next">
        <span className="ch-kick-tv">Coming up</span>
        <img src={to.game.art.alt ?? to.game.art.tv} alt="" />
        <h2>{to.game.name}</h2>
        <p>{to.instance.title.split(" · ")[0]} · {to.instance.detail.replace(/^Paused [^·]+· /, "")}</p>
      </aside>
      <footer className="ch-ticker">
        <Wordmark size={30} />
        <ol>
          {RUNNING_ORDER.map((id) => {
            const g = segment(id);
            return (
              <li key={id} className={id === to.game.id ? "is-next" : id === from.game.id ? "is-done" : ""}>
                <time>{g.slot}</time> {g.game.name}
              </li>
            );
          })}
          <li>
            <time>8:00</time> Hearthisle game night
          </li>
        </ol>
      </footer>
    </div>
  );
}
