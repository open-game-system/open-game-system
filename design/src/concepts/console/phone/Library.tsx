// The library: every game the family has, one shelf per way of playing. The kids' couch games are
// one shelf; game night and duels sit beside them. Each tile states what the game keeps for you
// (its integration tier, in family words).
import type { Store } from "../../../harness/store";
import { GAMES, type GameManifest } from "../../../world";
import type { S } from "../state";
import { GameArt } from "../ui/GameArt";
import { HomeHeader } from "./Home";

const keeps = (g: GameManifest) => (g.tier === 2 ? "Live status on Home" : g.tier === 1 ? "Keeps your place" : "Plays on the TV");

function Tile({ g, wide = false, note }: { g: GameManifest; wide?: boolean; note?: string }) {
  return (
    <article className={`cx-tile ${wide ? "cx-tile--wide" : ""}`}>
      <div className="cx-tile__art">
        <GameArt gameId={g.id} alt={!wide} />
      </div>
      <div className="cx-tile__plate">
        <b>{g.name}</b>
        <span>{note ?? `${g.ages} · ${g.minutes[0]}–${g.minutes[1]} min`}</span>
        <span className={`cx-tier cx-tier--${g.tier}`}>{keeps(g)}</span>
      </div>
    </article>
  );
}

export function LibraryView({ s }: { s: S; store: Store<S> }) {
  const couch = GAMES.filter((g) => g.shape === "couch");
  const live = GAMES.filter((g) => g.shape === "live");
  const duel = GAMES.filter((g) => g.shape === "async");
  const turns = s.duels.filter((d) => d.status === "yourTurn").length;
  return (
    <div className="cx-scroll">
      <HomeHeader />
      <h1 className="cx-h1">Library</h1>
      <section className="cx-sec">
        <h2 className="cx-h2">Together on the TV</h2>
        <p className="cx-shelfnote">Kids join on their iPads. 5–15 minutes.</p>
        <div className="cx-grid">
          {couch.map((g) => (
            <Tile key={g.id} g={g} />
          ))}
        </div>
      </section>
      <section className="cx-sec">
        <h2 className="cx-h2">Game night</h2>
        <p className="cx-shelfnote">Several homes, one board, over an evening or two.</p>
        {live.map((g) => (
          <Tile key={g.id} g={g} wide note="Turn 14 · resumes tonight at 8:00" />
        ))}
      </section>
      <section className="cx-sec">
        <h2 className="cx-h2">Duels</h2>
        <p className="cx-shelfnote">One move whenever you like, against one person.</p>
        {duel.map((g) => (
          <Tile key={g.id} g={g} wide note={`${turns} waiting on you · 5 open`} />
        ))}
      </section>
      <p className="cx-footnote">Any web game with an OGS manifest can join this library from a link.</p>
    </div>
  );
}
