// Home as a deck of activity cards. Every open game is one art-led card (its status, who it's
// with, one action) in a single horizontally paged deck, ordered by what needs you now. The TV card
// leads: on the console home, tapping another card brings it onto the TV (the phone is the
// remote), and the deck turns to it. A compact list of the same order is one tap away.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Store } from "../../../harness/store";
import type { DuelGame } from "../../../world";
import { deck, needsYou, tvGame, type DeckCard } from "../deck";
import { openNight } from "../nights";
import { castAndPlay, hereTonight, night, openDuel, openStartNew, pickActivity, saveOf, type S } from "../state";
import { Chip } from "../ui/Chip";
import { GameArt } from "../ui/GameArt";
import { HomesPath } from "../ui/HomesPath";
import { Gamepad, Plus, TvIcon } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";
import { beginNewNight } from "../nights";
import { DuelFace, OpponentMark } from "../wordduel/Opponent";
import { HomeHeader } from "./Home";

interface Action {
  label: string;
  bot: string;
  icon?: ReactNode;
  run: (x: S) => S;
}

const playNow = (gameId: string) => (x: S): S => (x.cast === "off" ? castAndPlay(x, gameId) : { ...x, onTv: gameId, tvFocus: gameId, phone: "controller" });

/** The card's one action. */
function actionOf(c: DeckCard, s: S): Action {
  if (c.kind === "couch") {
    const save = !s.fresh[c.gameId] ? saveOf(c.gameId) : null;
    if (s.onTv === c.gameId) return { label: "Controller", bot: "open-controller", icon: <Gamepad size={20} />, run: (x) => ({ ...x, phone: "controller" }) };
    if (s.onTv) return { label: "Switch to it", bot: `switch-${c.gameId}`, icon: <TvIcon size={20} />, run: (x) => ({ ...pickActivity(x, c.gameId), phone: "controller" }) };
    const label = save ? "Continue" : "Play on TV";
    return { label, bot: c.tv ? "play-on-tv" : `play-${c.gameId}`, icon: <TvIcon size={20} />, run: playNow(c.gameId) };
  }
  if (c.kind === "night") {
    const id = c.night ?? "";
    const k = c.status.kind;
    const label = k === "yours" ? "Roll" : k === "live" ? "Open game night" : k === "invited" ? "See who's in" : k === "coming" ? "Open tonight's night" : "See the board";
    return { label, bot: `open-night-${id}`, run: (x) => night(x, (ns) => openNight(ns, id)) };
  }
  const id = c.duel ?? "";
  return { label: c.status.kind === "yours" ? "Play your move" : "See the board", bot: `play-${id}`, run: (x) => openDuel(x, id) };
}

/** What tapping the card itself does: a couch card moves the TV's focus; others open. */
function bodyOf(c: DeckCard, s: S): ((x: S) => S) | null {
  if (c.kind === "couch") return s.onTv || c.tv ? null : (x) => pickActivity(x, c.gameId);
  return actionOf(c, s).run;
}

/** Word Duel has no captures: its card art is the board itself, the last word in tiles, the
 * opponent's sticker standing on it. */
function DuelCardArt({ d }: { d: DuelGame }) {
  const word = (d.lastWord ?? "").slice(0, 6).split("");
  const done = d.status === "completed" || d.status === "expired";
  return (
    <span className="dk-duelart" aria-hidden>
      <span className="dk-duelart__grid" />
      <span className="dk-duelart__word">
        {word.map((ch, i) => (
          <span key={i} className={`dk-tile ${done ? "is-old" : ""}`} style={{ transform: `rotate(${((i * 7) % 5) - 2}deg)` }}>
            {ch}
          </span>
        ))}
      </span>
      <span className="dk-duelart__who">
        <OpponentMark d={d} size={112} />
      </span>
    </span>
  );
}

function Who({ c, s, store }: { c: DeckCard; s: S; store: Store<S> }) {
  if (c.kind === "night") {
    const n = s.nights.list.find((x) => x.id === c.night);
    return n ? <HomesPath night={n} /> : null;
  }
  if (c.kind === "duel") {
    const d = s.duels.find((x) => x.id === c.duel);
    if (!d) return null;
    return (
      <p className="dk-score">
        <span>
          You <b>{d.you}</b>
        </span>
        <span>
          {d.opponent} <b>{d.them}</b>
        </span>
        <span className="dk-score__where">{d.opponentHome}</span>
      </p>
    );
  }
  const here = hereTonight(s);
  const stickers = (
    <span className="dk-who__stickers">
      {here.map((p) => (
        <Sticker key={p.id} person={p} size={38} />
      ))}
    </span>
  );
  if (!c.tv) return <p className="dk-who">{stickers}<span>{here.length} on the couch</span></p>;
  return (
    <button className="dk-who dk-who--btn" data-bot="couch-who" aria-label={`${here.length} here tonight. Change who's here`} onClick={() => store.update((x) => ({ ...x, who: true }))}>
      {stickers}
      <span>{here.length} here</span>
    </button>
  );
}

function Card({ c, s, store, arriving }: { c: DeckCard; s: S; store: Store<S>; arriving: boolean }) {
  const a = actionOf(c, s);
  const body = bodyOf(c, s);
  const d = c.duel ? s.duels.find((x) => x.id === c.duel) : undefined;
  const save = c.kind === "couch" && c.tv && !s.onTv && !s.fresh[c.gameId] ? saveOf(c.gameId) : null;
  return (
    <li className={`dk-card dk-card--${c.kind} dk-card--${c.status.kind} ${c.tv ? "is-tv" : ""} ${arriving ? "is-arriving" : ""}`}>
      <span className="dk-card__art">{d ? <DuelCardArt d={d} /> : <GameArt gameId={c.gameId} />}</span>
      {body ? (
        <button className="dk-card__hit" data-bot={c.id} aria-label={`${c.title}. ${c.status.label}`} onClick={() => store.update(body)} />
      ) : (
        <span className="dk-card__hit" data-bot={c.id} aria-hidden />
      )}
      <span className="dk-card__top">
        <Chip status={c.status} />
        {c.tv && (
          <span className="dk-card__tv">
            <TvIcon size={15} /> {s.onTv === c.gameId ? "Living room TV" : "TV home"}
          </span>
        )}
      </span>
      <div className="dk-card__body">
        <span className="dk-card__kicker">{c.kicker}</span>
        <h3 className={`dk-card__title ${c.kind === "duel" ? "dk-card__title--move" : ""}`}>{c.title}</h3>
        {c.line && <p className="dk-card__line">{c.line}</p>}
        <div className="dk-card__who">
          <Who c={c} s={s} store={store} />
        </div>
        <div className="dk-card__ctas">
          <button className={`cx-btn ${c.status.kind === "yours" ? "dk-btn--lamp" : "cx-btn--light"} dk-card__cta`} data-bot={a.bot} onClick={() => store.update(a.run)}>
            {a.icon}
            <span>{a.label}</span>
          </button>
          {save && (
            <button className="cx-btn cx-btn--line dk-card__new" data-bot="start-new" onClick={() => store.update((x) => openStartNew(x, c.gameId))}>
              New
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function Row({ c, s, store, arriving }: { c: DeckCard; s: S; store: Store<S>; arriving: boolean }) {
  const d = c.duel ? s.duels.find((x) => x.id === c.duel) : undefined;
  const go = c.kind === "couch" ? (x: S): S => ({ ...(x.onTv ? x : pickActivity(x, c.gameId)), phone: "home" }) : actionOf(c, s).run;
  const quiet = c.rank >= 7;
  return (
    <li className={`${arriving ? "is-arriving" : ""} ${quiet ? "is-quiet" : ""}`}>
      <button className="dk-row" data-bot={`row-${c.id}`} onClick={() => store.update(go)}>
        <span className={`dk-row__art ${d ? "dk-row__art--duel" : ""}`}>{d ? <DuelFace d={d} size={56} /> : <GameArt gameId={c.gameId} alt />}</span>
        <span className="dk-row__text">
          <b>{c.title}</b>
          <span>{c.kind === "duel" ? c.kicker : `${c.line || c.kicker}`}</span>
        </span>
        <Chip status={c.status} />
      </button>
    </li>
  );
}

/** One line under the title: who's waiting on you; when nobody is, what's next. */
function summary(cards: DeckCard[], s: S): string {
  const n = needsYou(cards);
  const moved = s.arrival?.phase === "landed" ? s.duels.find((d) => d.id === s.arrival?.id) : undefined;
  if (n > 0) return moved ? `${n} waiting on you · ${moved.opponent} just moved` : `${n} waiting on you`;
  const coming = s.nights.list.find((x) => x.when && x.status !== "live");
  return coming?.when ? `Nobody's waiting · game night ${coming.when.replace("Tonight ", "at ")}` : "Nobody's waiting on you";
}

const CardsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
    <rect x="2" y="4" width="12" height="15" rx="2.5" fill="currentColor" />
    <rect x="16" y="6" width="4" height="11" rx="1.5" fill="currentColor" opacity=".55" />
  </svg>
);
const ListIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
    {[4, 10, 16].map((y) => (
      <g key={y}>
        <rect x="2" y={y} width="4" height="3" rx="1" fill="currentColor" />
        <rect x="8" y={y} width="12" height="3" rx="1.5" fill="currentColor" />
      </g>
    ))}
  </svg>
);

export function Deck({ s, store, list }: { s: S; store: Store<S>; list: boolean }) {
  const cards = deck(s, list);
  const landed = s.arrival?.phase === "landed" ? `turn-${s.arrival.id}` : null;
  const ref = useRef<HTMLOListElement>(null);
  const [at, setAt] = useState(s.deckAt);
  const focus = tvGame(s);
  const opened = useRef(false);
  // Open on deckAt; after that, when the TV's focus changes (the phone is the remote), the deck
  // turns back to the TV card, where the newly focused game now stands.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!opened.current) {
      opened.current = true;
      const first = el.firstElementChild;
      if (first instanceof HTMLElement) el.scrollLeft = s.deckAt * (first.offsetWidth + 10);
      return;
    }
    el.scrollTo({ left: 0, behavior: "smooth" });
  }, [focus, list]);
  const onScroll = () => {
    const el = ref.current;
    const first = el?.firstElementChild;
    if (!el || !(first instanceof HTMLElement)) return;
    setAt(Math.round(el.scrollLeft / (first.offsetWidth + 10)));
  };
  const view = (to: S["phone"]) => store.update((x) => ({ ...x, phone: to, tab: "home" }));
  return (
    <div className={`dk ${list ? "dk--list" : ""}`}>
      <HomeHeader />
      <div className="dk-bar">
        <div className="dk-bar__text">
          <h1 className="dk-title">Friday night</h1>
          <p>{summary(cards, s)}</p>
        </div>
        <div className="dk-toggle" role="group" aria-label="Show as">
          <button className={!list ? "is-on" : ""} aria-pressed={!list} aria-label="Cards" data-bot="view-cards" onClick={() => view("home")}>
            <CardsIcon />
          </button>
          <button className={list ? "is-on" : ""} aria-pressed={list} aria-label="List" data-bot="view-list" onClick={() => view("inbox")}>
            <ListIcon />
          </button>
        </div>
      </div>
      {list ? (
        <div className="dk-listwrap">
          <ol className="dk-list">
            {cards.map((c) => (
              <Row key={c.id} c={c} s={s} store={store} arriving={c.id === landed} />
            ))}
          </ol>
          <button className="dk-newnight" data-bot="night-new" onClick={() => store.update((x) => night(x, beginNewNight))}>
            <Plus size={18} /> New game night with other homes
          </button>
        </div>
      ) : (
        <>
          <ol className="dk-deck" ref={ref} onScroll={onScroll} aria-label="Your games, what needs you first">
            {cards.map((c) => (
              <Card key={c.id} c={c} s={s} store={store} arriving={c.id === landed} />
            ))}
            <li className="dk-card dk-card--end">
              <button className="dk-end" data-bot="night-new" onClick={() => store.update((x) => night(x, beginNewNight))}>
                <span className="dk-end__plus">
                  <Plus size={28} />
                </span>
                <b>New game night</b>
                <span>Play Hearthisle with the Okafors, Nana & Pop, anyone you play with</span>
              </button>
            </li>
          </ol>
          <div className="dk-index">
            <span className="dk-index__n">
              {Math.min(at + 1, cards.length)} of {cards.length}
            </span>
            <span className="dk-index__dots" aria-hidden>
              {cards.map((c, i) => (
                <span key={c.id} className={`dk-dot dk-dot--${c.status.kind} ${i === at ? "is-on" : ""}`} />
              ))}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
