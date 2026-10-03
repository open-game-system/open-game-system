// Cast, nothing running: the living room's ambient screen. Readable at 3 m, calm, nothing to press.
import { COUCH, gameById, HOME } from "../../../world";
import { Patch, Quilt } from "../ui/Patch";
import { SEAT_PATCHES } from "../phone/PeopleHome";

const HERE = ["dad", "juneau", "ava"];

export function TvAmbient() {
  const shelf = ["rocket-crew", "bake-shop", "story-nook"].map((id) => ({ g: gameById(id), i: COUCH.find((x) => x.gameId === id) }));
  return (
    <div className="pf-amb">
      <img className="pf-amb-bg" src="/art/rocket-crew/alt.jpg" alt="" />
      <div className="pf-amb-left">
        <p className="pf-tv-kicker">Friday evening</p>
        <h1 className="pf-amb-clock">7:10</h1>
        <h2 className="pf-amb-who">Us, on the couch</h2>
        <div className="pf-amb-people">
          {HOME.people.map((p) => (
            <div key={p.id} className="pf-amb-person">
              <Patch person={p} size={96} dim={!HERE.includes(p.id)} />
              <span>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="pf-amb-right">
        <p className="pf-tv-kicker">Picks up where you left off</p>
        {shelf.map(({ g, i }) => (
          <div key={g.id} className="pf-amb-card">
            <img src={g.art.tv} alt="" />
            <div>
              <b>{g.name}</b>
              <span>{i?.title}</span>
            </div>
          </div>
        ))}
        <div className="pf-amb-later">
          <Quilt people={SEAT_PATCHES} size={64} />
          <div>
            <b>Hearthisle at 8:00</b>
            <span>with the Okafors and Nana &amp; Pop</span>
          </div>
        </div>
      </div>
      <p className="pf-amb-hint">Choose on Jonathan's phone</p>
    </div>
  );
}
