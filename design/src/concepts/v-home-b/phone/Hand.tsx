// Your hand: every turn waiting on you is a card you're holding, whatever the game. Each card leads
// with the person who's waiting (their sticker, their name), then what they did. Below the hand, the
// people holding cards of their own (their move), as a row of stickers into All turns.
import type { ReactNode } from "react";
import { useStore, type Store } from "../../../harness/store";
import { HOME, HOUSEHOLDS, type DuelGame } from "../../../world";
import { everyGame, type TurnItem } from "../inbox";
import { household, US } from "../nights";
import type { S } from "../state";
import { GameArt } from "../ui/GameArt";
import { Chevron } from "../ui/Icons";
import { Crest, Sticker, type StickerOwner } from "../ui/Sticker";
import { MiniBoard } from "../wordduel/Opponent";
import { openTurn } from "./TurnRows";

/** The person behind a duel: their sticker (family people reuse their own). */
export function duelPerson(d: DuelGame): StickerOwner {
  for (const h of HOUSEHOLDS) {
    const p = h.people.find((x) => x.name === d.opponent);
    if (p) return p;
  }
  return { id: d.id, sticker: d.sticker };
}

interface Face {
  who: string;
  what: string;
  game: string;
  art: ReactNode;
}

function faceOf(item: TurnItem, s: S): Face {
  const d = item.duel ? s.duels.find((x) => x.id === item.duel) : undefined;
  if (d) {
    const what = d.lastMove.startsWith(`${d.opponent} `) ? d.lastMove.slice(d.opponent.length + 1) : d.lastMove;
    return {
      who: d.opponent,
      what,
      game: item.detail,
      art: (
        <span className="ft-card__face">
          <MiniBoard d={d} size={46} />
          <span className="ft-card__sticker">
            <Sticker person={duelPerson(d)} size={46} />
          </span>
        </span>
      ),
    };
  }
  const n = item.target.kind === "night" ? s.nights.list.find((x) => x.id === (item.target.kind === "night" ? item.target.id : "")) : undefined;
  const guests = n ? n.homes.filter((h) => h.householdId !== US && h.reply !== "declined") : [];
  return {
    who: "Your roll",
    what: `${guests.length} homes waiting`,
    game: item.detail,
    art: (
      <span className="ft-card__face ft-card__face--night">
        <span className="ft-card__nightart">
          <GameArt gameId={item.gameId} />
        </span>
        <span className="ft-card__crests">
          {guests.map((h) => (
            <Crest key={h.householdId} household={household(h.householdId)} size={30} shared />
          ))}
        </span>
      </span>
    ),
  };
}

function Card({ item, s, store, i, arriving }: { item: TurnItem; s: S; store: Store<S>; i: number; arriving: boolean }) {
  const f = faceOf(item, s);
  return (
    <li className={`ft-card-slot ft-fan-${i % 3} ${arriving ? "is-arriving" : ""}`}>
      <button className="ft-card" data-bot={item.id} aria-label={`${f.who} ${f.what}. ${f.game}. Your turn`} onClick={() => store.update((x) => openTurn(x, item.target))}>
        {f.art}
        <b className="ft-card__who">{f.who}</b>
        <span className="ft-card__what">{f.what}</span>
        <span className="ft-card__game">{f.game}</span>
      </button>
    </li>
  );
}

/** People whose move it is, deduped, as stickers (their move). */
function theirPeople(s: S): { key: string; owner: StickerOwner; name: string }[] {
  const out: { key: string; owner: StickerOwner; name: string }[] = [];
  for (const t of everyGame(s).theirs) {
    const d = t.duel ? s.duels.find((x) => x.id === t.duel) : undefined;
    if (d) out.push({ key: d.id, owner: duelPerson(d), name: d.opponent });
  }
  return out;
}

export function Hand({ s, store }: { s: S; store: Store<S> }) {
  const live = useStore(store);
  const all = everyGame(s);
  const cards = all.yours;
  const landed = live.arrival?.phase === "landed" ? `turn-${live.arrival.id}` : null;
  const them = theirPeople(s);
  const me = HOME.people.find((p) => p.id === "dad");
  const names = them.map((p) => p.name);
  const waitLine = names.length === 0 ? "Nobody else is thinking" : names.length <= 2 ? `${names.join(" and ")} thinking` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""} thinking`;
  return (
    <section className="ft-hand" aria-label="Your hand: turns waiting on you">
      <header className="ft-hand__head">
        {me && <Sticker person={me} size={38} />}
        <h2>
          Your hand
          {cards.length > 0 && (
            <span key={cards.length} className="ft-hand__count">
              {cards.length}
            </span>
          )}
        </h2>
      </header>
      {cards.length === 0 ? (
        <p className="ft-hand__empty">No cards in your hand. When someone moves, we'll deal you in.</p>
      ) : (
        <ul className={`ft-cards ft-cards--${Math.min(cards.length, 3)}`}>
          {cards.map((t, i) => (
            <Card key={t.id} item={t} s={s} store={store} i={i} arriving={t.id === landed} />
          ))}
        </ul>
      )}
      <button className="ft-others" data-bot="inbox-all" onClick={() => store.update((x) => ({ ...x, phone: "inbox" }))}>
        <span className="ft-others__stickers" aria-hidden>
          {them.map((p) => (
            <Sticker key={p.key} person={p.owner} size={32} />
          ))}
        </span>
        <span className="ft-others__text">
          <b>{waitLine}</b>
          <span>Every game, by who's playing</span>
        </span>
        <Chevron size={18} />
      </button>
    </section>
  );
}
