// In a game, the phone is that game's controller (the game's own page) under a thin OGS bar whose
// Home button is always there: it folds the game back into its box on the TV's shelf.
import { gameById } from "../../../world";
import { home } from "../actions";
import { personOf, roleFor, type S } from "../state";
import { gameVars } from "../ui";

type Act = (fn: (s: S) => S) => void;

export function HomeBar({ s, gameId, act }: { s: S; gameId: string; act: Act }) {
  const g = gameById(gameId);
  return (
    <div className="cr-homebar">
      <button type="button" className="cr-homebtn" data-bot="home" onClick={() => act(home)}>
        <span className="cr-glyph-home" />
        Home
      </button>
      <div className="cr-homebar-what">
        <div className="cr-homebar-name">{g.name}</div>
        <div className="cr-homebar-at">{s.saves[gameId]?.at ?? "Game night · turn 14"} · on the TV</div>
      </div>
      <div className="cr-homebar-crew">
        {s.crew.map((id) => (
          <img key={id} src={personOf(id).sticker} alt={personOf(id).name} />
        ))}
      </div>
    </div>
  );
}

/** Stand-in for the game's own controller page: the game owns everything under the bar. */
export function GameController({ s, gameId, act }: { s: S; gameId: string; act: Act }) {
  const g = gameById(gameId);
  const me = personOf(s.holder);
  return (
    <div className="cr-gamectl" style={gameVars(g)}>
      <HomeBar s={s} gameId={gameId} act={act} />
      <div className="cr-gamepage">
        <div className="cr-gamepage-art">
          <img src={g.art.alt ?? g.art.tv} alt="" />
        </div>
        <div className="cr-gamepage-role">
          <img src={me.sticker} alt="" />
          <div>
            <div className="cr-gamepage-you">{me.name}, you're the</div>
            <div className="cr-gamepage-rolename">{roleFor(g, me)}</div>
          </div>
        </div>
        <div className="cr-gamepage-pads">
          <span className="cr-gpad is-a" />
          <span className="cr-gpad is-b" />
          <span className="cr-gpad is-c" />
          <span className="cr-gpad is-d" />
        </div>
        <div className="cr-gamepage-foot">{g.name}'s own controls</div>
      </div>
    </div>
  );
}
