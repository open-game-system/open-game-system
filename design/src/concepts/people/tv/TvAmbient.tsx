// Cast, nothing running: the living room's ambient screen. Readable at 3 m, calm, nothing to press.
import { COUCH, gameById, HOME } from "../../../world";
import { Patch, Quilt } from "../ui/Patch";
import { SEAT_PATCHES } from "../phone/PeopleHome";

const HERE = ["dad", "juneau", "ava"];

/** The brand's quiet backdrop: a big stitched quilt in the household's colours, barely there. */
function QuiltBackdrop() {
  const colors = HOME.people.map((p) => p.color);
  const cells = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 9; c++) {
      const col = colors[(r * 3 + c * 7) % colors.length] ?? "#fff";
      cells.push(
        <g key={`${r}-${c}`}>
          <rect x={c * 240 - 60} y={r * 240 - 90} width="240" height="240" fill={col} opacity={(r + c) % 3 === 0 ? 0.13 : 0.05} />
          <rect x={c * 240 - 48} y={r * 240 - 78} width="216" height="216" rx="30" fill="none" stroke="#f6eddc" strokeOpacity="0.1" strokeWidth="3" strokeDasharray="10 12" />
        </g>,
      );
    }
  }
  return (
    <svg className="pf-amb-bg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {cells}
    </svg>
  );
}

export function TvAmbient() {
  const shelf = ["rocket-crew", "bake-shop", "story-nook"].map((id) => ({ g: gameById(id), i: COUCH.find((x) => x.gameId === id) }));
  return (
    <div className="pf-amb">
      <QuiltBackdrop />
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
