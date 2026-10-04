// The TV when no game is running: the family's console home. The focused couch game's art fills the
// room; the console adds the household, a big clock, tonight's game night as one ambient line, and
// the couch shelf. Nobody touches it: the phone moves the focus.
import { HOME, gameById, type Person } from "../../../world";
import { couchShelf, type Activity } from "../activities";
import { hereTonight, type S } from "../state";
import { Mark, Portrait } from "../ui/Brand";
import { PhoneIcon, TabletIcon } from "../ui/Icons";
import { GameNightLine } from "./GameNight";
import { Clock, FollowPath } from "./Motif";
import { TvArt } from "./TvArt";

export function TvHome({ s }: { s: S }) {
  const all = couchShelf(s);
  const couch = all.filter((a) => gameById(a.gameId).shape === "couch" && gameById(a.gameId).art.tv);
  const focus = all.find((a) => a.gameId === s.tvFocus && gameById(a.gameId).art.tv) ?? couch[0];
  if (!focus) return null;
  const shelf = couch.slice(0, 5);
  const focusIsCouch = shelf.includes(focus);
  return (
    <div className="ct-home">
      <div className="ct-home__bg" key={focus.gameId}>
        <TvArt gameId={focus.gameId} />
      </div>
      <div className="ct-home__shade" />
      <header className="ct-top">
        <span className="ct-brand">
          <Mark size={46} />
          <span>
            {HOME.name} <em>· Living room</em>
          </span>
        </span>
        <Clock />
      </header>
      {focusIsCouch && <GameNightLine s={s} />}
      <Focus focus={focus} here={hereTonight(s)} />
      <Shelf shelf={shelf} focus={focus} />
      <footer className="ct-home__hint">
        <PhoneIcon size={32} />
        Choose on Jonathan's phone
      </footer>
      <FollowPath className="ct-home__path" w={170} h={120} d="M160 110 C 120 40, 60 30, 10 20" />
    </div>
  );
}

function Focus({ focus, here }: { focus: Activity; here: Person[] }) {
  return (
    <section className="ct-home__focus" key={focus.gameId}>
      <span className="ct-kicker">{focus.badge || "Jump back in"}</span>
      <h1>{gameById(focus.gameId).name}</h1>
      <p className="ct-home__title">{focus.title}</p>
      <p className="ct-home__detail">{focus.detail}</p>
      <div className="ct-home__here">
        {here.map((p) => (
          <span key={p.id} className="ct-here">
            <Portrait person={p} size={56} />
            <span>{p.name}</span>
            {p.band === "grownup" ? <PhoneIcon size={26} /> : <TabletIcon size={26} />}
          </span>
        ))}
      </div>
    </section>
  );
}

function Shelf({ shelf, focus }: { shelf: Activity[]; focus: Activity }) {
  return (
    <section className="ct-shelf" aria-label="Couch games">
      {shelf.map((a, i) => (
        <div key={a.id} className={`ct-shelf__tile ${a === focus ? "is-focus" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
          <div className="ct-shelf__art">
            <TvArt gameId={a.gameId} />
          </div>
          <span className="ct-shelf__label">{gameById(a.gameId).name}</span>
        </div>
      ))}
    </section>
  );
}
