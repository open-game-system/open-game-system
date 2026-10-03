// Continuity: the channel on air between segments. A clock, what's coming up, who's here tonight.
import { gameById } from "../../../world";
import { Wordmark } from "../brand/Mark";
import { RUNNING_ORDER, TONIGHT, segment } from "../programme";
import type { S } from "../state";

export function Continuity({ s }: { s: S }) {
  const up = segment(s.onAir);
  const rest = RUNNING_ORDER.filter((g) => g !== s.onAir);
  return (
    <div className="ch-tv ch-cont">
      <img className="ch-cont-art" src={up.game.art.tv} alt="" />
      <div className="ch-cont-shade" />
      <header className="ch-cont-top">
        <Wordmark size={40} />
        <time>7:10</time>
      </header>
      <section className="ch-cont-up">
        <span className="ch-kick-tv">Coming up</span>
        <h1>{up.game.name}</h1>
        <p>{up.instance.title} · {up.instance.detail.split(" · ")[0]}</p>
        <ul className="ch-cont-here">
          {TONIGHT.map((p) => (
            <li key={p.id}>
              <i style={{ background: p.color }} />
              {p.name}
            </li>
          ))}
        </ul>
      </section>
      <footer className="ch-ticker ch-ticker-cont">
        <span className="ch-kick-tv">Tonight</span>
        <ol>
          <li className="is-next">
            <time>7:10</time> {up.game.name}
          </li>
          {rest.map((id) => (
            <li key={id}>
              <time>{segment(id).slot}</time> {gameById(id).name}
            </li>
          ))}
          <li>
            <time>8:00</time> Hearthisle game night
          </li>
        </ol>
      </footer>
    </div>
  );
}
