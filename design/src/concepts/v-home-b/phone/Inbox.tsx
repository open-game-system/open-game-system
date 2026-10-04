// All turns, "Family table" style: every game with turns, organised by the people in it. Each person
// (or, for a game night, each table of homes) gets a place card: their sticker, their name, where
// they are, and where your game with them stands. Grouped by who has to move.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { everyGame, type TurnItem } from "../inbox";
import { household, US } from "../nights";
import { goHome, type S } from "../state";
import { type Bucket } from "../status";
import { StatusBar } from "../ui/Brand";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { Chevron } from "../ui/Icons";
import { Crest, Sticker } from "../ui/Sticker";
import { duelPerson } from "./Hand";
import { openTurn } from "./TurnRows";

const GROUPS: { b: Bucket; title: string; lede?: string }[] = [
  { b: "tv", title: "At our table now" },
  { b: "yours", title: "Waiting on you" },
  { b: "coming", title: "Places set" },
  { b: "theirs", title: "You're waiting on" },
  { b: "paused", title: "Paused" },
  { b: "done", title: "Finished lately" },
];

function PersonCard({ item, s, store }: { item: TurnItem; s: S; store: Store<S> }) {
  const d = item.duel ? s.duels.find((x) => x.id === item.duel) : undefined;
  const yours = item.status.kind === "yours";
  if (d) {
    const line = yours ? (d.lastMove.startsWith(`${d.opponent} `) ? d.lastMove.slice(d.opponent.length + 1) : d.lastMove) : item.title.replace(`${d.opponent} · `, "").replace(`${d.opponent}'s move`, `You played ${d.lastWord ?? ""}`);
    return (
      <li>
        <button className={`ft-pc ${yours ? "is-yours" : ""} ft-pc--${item.status.kind}`} data-bot={item.id} onClick={() => store.update((x) => openTurn(x, item.target))}>
          <span className="ft-pc__who">
            <Sticker person={duelPerson(d)} size={58} />
          </span>
          <b className="ft-pc__name">{d.opponent}</b>
          <span className="ft-pc__where">{d.opponentHome === "Home" ? "At home" : d.opponentHome} · Word Duel</span>
          <span className="ft-pc__line">{line}</span>
          <span className="ft-pc__foot">
            <Chip status={item.status} />
          </span>
        </button>
      </li>
    );
  }
  const n = item.target.kind === "night" ? s.nights.list.find((x) => x.id === (item.target.kind === "night" ? item.target.id : "")) : undefined;
  const guests = n ? n.homes.filter((h) => h.householdId !== US && h.reply !== "declined") : [];
  return (
    <li className="ft-pc-wide">
      <button className={`ft-pc ft-pc--night ${yours ? "is-yours" : ""}`} data-bot={item.id} onClick={() => store.update((x) => openTurn(x, item.target))}>
        <span className="ft-pc__plate" aria-hidden>
          <GameArt gameId={item.gameId} />
        </span>
        <span className="ft-pc__crests" aria-hidden>
          {guests.map((h) => (
            <Crest key={h.householdId} household={household(h.householdId)} size={44} shared />
          ))}
        </span>
        <span className="ft-pc__nighttext">
          <b className="ft-pc__name">{guests.map((h) => h.name.replace(/^The /, "")).join(" & ")}</b>
          <span className="ft-pc__where">{gameById(item.gameId).name} game night</span>
          <span className="ft-pc__line">{item.status.kind === "yours" ? item.title : item.detail.replace(`${gameById(item.gameId).name} · `, "")}</span>
          <span className="ft-pc__foot">
            <Chip status={item.status} />
          </span>
        </span>
      </button>
    </li>
  );
}

export function Inbox({ s, store }: { s: S; store: Store<S> }) {
  const all = everyGame(s);
  return (
    <div className={`cx-phone ${s.textScale > 1 ? "cx-phone--dt" : ""}`}>
      <StatusBar dark />
      <div className="cx-topbar">
        <button className="cx-back" data-bot="inbox-home" onClick={() => store.update(goHome)}>
          <Chevron size={20} dir="left" /> Home
        </button>
      </div>
      <div className="cx-scroll ft-inbox">
        <h1 className="cx-title cx-title--page">Everyone we're playing</h1>
        <p className="cx-lede">Every game with turns, by the people in it.</p>
        {GROUPS.filter((g) => all[g.b].length > 0 || g.b === "yours").map((g) => (
          <section key={g.b} className={`ft-group ft-group--${g.b}`} aria-label={g.title}>
            <h2 className="ft-group__h">
              {g.title}
              {g.b === "yours" && all.yours.length > 0 && <span className="ft-hand__count">{all.yours.length}</span>}
            </h2>
            {all[g.b].length === 0 ? (
              <p className="ft-hand__empty">Nobody is waiting on you. We'll tell you when someone moves.</p>
            ) : (
              <ul className="ft-pcs">
                {all[g.b].map((t) => (
                  <PersonCard key={t.id} item={t} s={s} store={store} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
