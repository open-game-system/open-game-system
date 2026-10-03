// The Games tab: where you start something new with someone. Grouped by who you'd play it with.
import { COUCH, GAMES, type GameManifest } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, type S } from "../state";
import { StatusBar, TabBar } from "../ui/Chrome";
import { tabTo } from "./PeopleHome";

const TIER_PAYOFF = ["Casts to your TV", "Saves with your household", "Shows up in People when it's your move"];

function WordTiles() {
  return (
    <div className="pf-wordtiles" aria-hidden="true">
      {["W", "O", "R", "D"].map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

function Tile({ g, store, wide }: { g: GameManifest; store: Store<S>; wide?: boolean }) {
  const inst = COUCH.find((i) => i.gameId === g.id);
  const open = () => store.update(go(g.shape === "async" ? { kind: "duels" } : g.shape === "live" ? { kind: "game-night" } : { kind: "couch" }));
  return (
    <button className={`pf-gtile${wide ? " wide" : ""}`} data-bot={`game-${g.id}`} onClick={open}>
      {g.art.tv ? <img src={g.art.tv} alt="" /> : <WordTiles />}
      <span className="pf-gtile-body">
        <span className="pf-gtile-name">{g.name}</span>
        <span className="pf-gtile-line">{inst?.status === "suspended" ? `Saved: ${inst.title}` : g.tagline}</span>
        <span className="pf-gtile-tier">{TIER_PAYOFF[g.tier]}</span>
      </span>
    </button>
  );
}

export function Library({ s, store }: { s: S; store: Store<S> }) {
  const mine = s.duels.filter((d) => d.status === "yourTurn").length;
  const couch = GAMES.filter((g) => g.shape === "couch");
  const live = GAMES.filter((g) => g.shape === "live");
  const duel = GAMES.filter((g) => g.shape === "async");
  return (
    <div className="pf-phone">
      <StatusBar />
      <div className="pf-largetitle">
        <h1>Games</h1>
      </div>
      <p className="pf-lede">Start something with your people.</p>
      <div className="pf-scroll">
        <div className="pf-section">With us, on the couch</div>
        <div className="pf-ggrid">
          {couch.map((g) => (
            <Tile key={g.id} g={g} store={store} />
          ))}
        </div>
        <div className="pf-section">With other homes, on game night</div>
        <div className="pf-ggrid">
          {live.map((g) => (
            <Tile key={g.id} g={g} store={store} wide />
          ))}
        </div>
        <div className="pf-section">With one person, over days</div>
        <div className="pf-ggrid">
          {duel.map((g) => (
            <Tile key={g.id} g={g} store={store} wide />
          ))}
        </div>
        <div style={{ height: 20 }} />
      </div>
      <TabBar current="games" badge={mine} onTab={(t) => tabTo(store, t)} />
    </div>
  );
}
