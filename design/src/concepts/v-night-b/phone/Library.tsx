// The library: every game the family has, one shelf per way of playing. The kids' couch games are
// one shelf; game night and duels sit beside them. A tile shows what the game told us (paused at
// day 4, something new) in the shared status words; a game that reports nothing shows its ages.
// Integration tiers are for developers and never named here.
import type { Store } from "../../../harness/store";
import { GAMES, type GameManifest } from "../../../world";
import { nightLine, nightStatus } from "../nights";
import type { S } from "../state";
import { couchStatus, st, type Status } from "../status";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { HomeHeader } from "./Home";

function Tile({ g, wide = false, note, status }: { g: GameManifest; wide?: boolean; note?: string; status?: Status }) {
  return (
    <article className={`cx-tile ${wide ? "cx-tile--wide" : ""}`}>
      <div className="cx-tile__art">
        <GameArt gameId={g.id} alt={!wide} />
      </div>
      <div className="cx-tile__plate">
        <b>{g.name}</b>
        <span>{note ?? `${g.ages} · ${g.minutes[0]}–${g.minutes[1]} min`}</span>
        {status && <Chip status={status} />}
      </div>
    </article>
  );
}

export function LibraryView({ s }: { s: S; store: Store<S> }) {
  const couch = GAMES.filter((g) => g.shape === "couch");
  const live = GAMES.filter((g) => g.shape === "live");
  const duel = GAMES.filter((g) => g.shape === "async");
  const turns = s.duels.filter((d) => d.status === "yourTurn").length;
  const open = s.duels.filter((d) => d.status === "yourTurn" || d.status === "waiting").length;
  const night = s.nights.list[0];
  return (
    <div className="cx-scroll">
      <HomeHeader />
      <h1 className="cx-h1">Library</h1>
      <section className="cx-sec">
        <h2 className="cx-h2">Together on the TV</h2>
        <p className="cx-shelfnote">Kids join on their iPads. 5–15 minutes.</p>
        <div className="cx-grid">
          {couch.map((g) => (
            <Tile key={g.id} g={g} status={couchStatus(g.id, s.onTv, s.savedTonight)} />
          ))}
        </div>
      </section>
      <section className="cx-sec">
        <h2 className="cx-h2">Game night</h2>
        <p className="cx-shelfnote">Several homes, one board, over an evening or two.</p>
        {live.map((g) => (
          <Tile key={g.id} g={g} wide note={night ? nightLine(night) : undefined} status={night ? nightStatus(night, s.onTv) : undefined} />
        ))}
      </section>
      <section className="cx-sec">
        <h2 className="cx-h2">Duels</h2>
        <p className="cx-shelfnote">One move whenever you like, against one person.</p>
        {duel.map((g) => (
          <Tile key={g.id} g={g} wide note={`${open} open games`} status={turns > 0 ? st("yours", `${turns} your turn`) : undefined} />
        ))}
      </section>
      <p className="cx-footnote">Sent a link to a new game? Open it on this phone and it joins the library.</p>
    </div>
  );
}
