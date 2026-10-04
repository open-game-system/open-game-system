// Lane 3, "Coming up": each game night is its invitation card, lying on the table: the game's art,
// the date, the homes' crests with their answers, and (while it's paused) the bookmark ribbon.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { beginNewNight, household, openNight, short, type Night } from "../nights";
import { comingUp } from "../inbox";
import { night, type S } from "../state";
import { GameArt } from "../ui/GameArt";
import { Lane } from "../ui/Lane";
import { Plus } from "../ui/Icons";
import { Crest } from "../ui/Sticker";
import { Ribbon, Stamp, cardDate, ribbonWords, stampOf } from "./night/card";

export function NightCard({ n, store }: { n: Night; s: S; store: Store<S> }) {
  const g = gameById(n.gameId);
  return (
    <button className={`iv-mini ${n.status === "paused" ? "has-ribbon" : ""}`} data-bot={`night-${n.id}`} onClick={() => store.update((x) => night(x, (ns) => openNight(ns, n.id)))}>
      <span className="iv-mini__plate">
        <GameArt gameId={n.gameId} alt={n.id !== "hi-1"} />
      </span>
      <span className="iv-mini__words">
        <span className="iv-mini__kicker">Game night</span>
        <b className="iv-mini__title">{g.name}</b>
        <span className="iv-mini__when">{cardDate(n.when)}</span>
      </span>
      <span className="iv-mini__homes">
        {n.homes.map((h) => {
          const st = stampOf(h, n);
          return (
            <span key={h.householdId} className="iv-mini__home">
              <Crest household={household(h.householdId)} size={34} shared dim={st.kind === "no"} />
              <span className="iv-mini__name">{short(h.name)}</span>
              <Stamp kind={st.kind}>{st.word}</Stamp>
            </span>
          );
        })}
      </span>
      {n.status === "paused" && <Ribbon words={ribbonWords(n)} />}
    </button>
  );
}

/** Lane 3, "Coming up": game nights with a time set (and new ones waiting on replies). A night
 * whose turn it is sits in Your turn instead, and one on our TV is the TV lane's: never twice. */
export function NightsLane({ s, store }: { s: S; store: Store<S> }) {
  const ids = comingUp(s).map((t) => (t.target.kind === "night" ? t.target.id : ""));
  const list = s.nights.list.filter((n) => ids.includes(n.id));
  return (
    <div ref={(el) => { if (el && s.nights.peek) el.scrollIntoView({ block: "start" }); }}>
      <Lane
        id="nights"
        title="Coming up"
        action={
          <button className="cx-lane__more" data-bot="night-new" onClick={() => store.update((x) => night(x, beginNewNight))}>
            <Plus size={16} /> New card
          </button>
        }
      >
        {list.length === 0 && <p className="cx-lane__empty">No game nights set. Make a card for the homes you play with.</p>}
        <div className="iv-minis">
          {list.map((n) => (
            <NightCard key={n.id} n={n} s={s} store={store} />
          ))}
        </div>
      </Lane>
    </div>
  );
}
