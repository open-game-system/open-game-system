// The TV when no game is running: an ambient console home. The focused activity's art fills the
// room, slowly drifting; the console only adds a title, a clock and a shelf. Nobody touches it:
// the phone moves the focus.
import { gameById } from "../../../world";
import { activities } from "../activities";
import { PRESENT, type S } from "../state";
import { Mark, Portrait } from "../ui/Brand";
import { GameArt } from "../ui/GameArt";
import { PhoneIcon, TabletIcon } from "../ui/Icons";

export function TvHome({ s }: { s: S }) {
  const acts = activities(s).filter((a) => gameById(a.gameId).art.tv);
  const focus = acts.find((a) => a.gameId === s.tvFocus) ?? acts[0];
  if (!focus) return null;
  const game = gameById(focus.gameId);
  const shelf = [focus, ...acts.filter((a) => a !== focus)].slice(0, 6);
  return (
    <div className="tv-home">
      <div className="tv-home__bg" key={focus.gameId}>
        <GameArt gameId={focus.gameId} />
      </div>
      <div className="tv-home__shade" />
      <header className="tv-home__top">
        <span className="tv-brand">
          <Mark size={40} />
          <span>Living room</span>
        </span>
        <span className="tv-clock">
          <b>7:10</b>
          <span>Friday</span>
        </span>
      </header>
      <section className="tv-home__focus">
        <span className="tv-kicker">{focus.badge || "Jump back in"}</span>
        <h1>{game.name}</h1>
        <p className="tv-home__title">{focus.title}</p>
        <p className="tv-home__detail">{focus.detail}</p>
        <div className="tv-home__here">
          {PRESENT.map((p) => {
            const kid = p.band !== "grownup";
            return (
              <span key={p.id} className="tv-here">
                <Portrait person={p} size={52} />
                <span>{p.name}</span>
                {kid ? <TabletIcon size={26} /> : <PhoneIcon size={26} />}
              </span>
            );
          })}
        </div>
      </section>
      <section className="tv-shelf">
        {shelf.map((a) => (
          <div key={a.id} className={`tv-shelf__tile ${a === focus ? "is-focus" : ""}`}>
            <div className="tv-shelf__art">
              <GameArt gameId={a.gameId} alt />
            </div>
            {a === focus ? null : <span className="tv-shelf__label">{gameById(a.gameId).name}</span>}
          </div>
        ))}
      </section>
      <footer className="tv-hint">
        <PhoneIcon size={30} />
        Choose on Jonathan's phone
      </footer>
    </div>
  );
}
