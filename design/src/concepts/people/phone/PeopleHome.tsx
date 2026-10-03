// The People tab: every thread is a person, a household, or a group of homes.
// Your move = unread. The household's couch thread is pinned like a live call.
import { gameById, HEARTHISLE, HOME, person, type DuelGame } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, type S } from "../state";
import { Patch, Quilt } from "../ui/Patch";
import { StatusBar, TabBar, type Tab } from "../ui/Chrome";
import { IconTv } from "../ui/Icons";
import { when } from "../ui/time";

export const opponent = (d: DuelGame) => ({ id: d.opponent.toLowerCase().replace(/\s/g, "-"), color: d.color });
export const SEAT_PATCHES = HEARTHISLE.seats.map((seat) => ({ id: seat.householdId, color: seat.color }));
export const ON_COUCH = ["dad", "juneau", "ava"].map(person);

export function tabTo(store: Store<S>, t: Tab) {
  store.update(go(t === "people" ? { kind: "people", filter: "all" } : t === "games" ? { kind: "library" } : { kind: "household" }));
}

function UsCard({ s, store }: { s: S; store: Store<S> }) {
  const game = s.couch.gameId ? gameById(s.couch.gameId) : undefined;
  return (
    <button className="pf-us" data-bot="open-couch" onClick={() => store.update(go({ kind: "couch" }))}>
      <div className="pf-us-head">
        <h2>Us, on the couch</h2>
        <span className="pf-onair">
          <IconTv size={16} /> Living room TV
        </span>
      </div>
      <div className="pf-us-live">
        {game && <img className="pf-us-art" src={game.art.tv} alt="" />}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="pf-us-game">{game ? `${game.name} · Mission 6` : "Nothing on yet"}</span>
          <span className="pf-us-sub">Playing now, since 7:02</span>
          <span className="pf-stack">
            {ON_COUCH.map((p) => (
              <Patch key={p.id} person={p} size={30} />
            ))}
          </span>
        </div>
      </div>
      <div className="pf-us-also">
        <Patch person={person("juneau")} size={34} />
        <span>
          <b>Juneau's dragon Ember is ready</b> to star in tonight's Story Nook
        </span>
      </div>
    </button>
  );
}

export function DuelRow({ d, store, from = "people" }: { d: DuelGame; store: Store<S>; from?: "people" | "duels" }) {
  const mine = d.status === "yourTurn";
  return (
    <button className={`pf-row${mine ? " unread" : ""}`} data-bot={`duel-${d.opponent.toLowerCase().replace(/\s/g, "-")}`} onClick={() => store.update(go({ kind: "duel", duelId: d.id, from }))}>
      <Patch person={opponent(d)} size={50} dim={d.status === "expired"} />
      <span className="pf-row-main">
        <span className="pf-row-top">
          <span className="pf-name">{d.opponent}</span>
          <span className="pf-time">{when(d.updatedAt)}</span>
        </span>
        <span className="pf-row-line">{d.lastMove}</span>
        <span className="pf-row-top">
          <span className="pf-row-game">
            Word Duel · {d.you}–{d.them}
          </span>
          {mine && <span className="pf-yourmove">Your move</span>}
        </span>
      </span>
    </button>
  );
}

export function PeopleHome({ s, store }: { s: S; store: Store<S> }) {
  const filter = s.phone.kind === "people" ? s.phone.filter : "all";
  const mine = s.duels.filter((d) => d.status === "yourTurn");
  const theirs = s.duels.filter((d) => d.status === "waiting");
  const done = s.duels.filter((d) => d.status === "completed" || d.status === "expired");
  const setFilter = (f: "all" | "yourMove") => store.update(go({ kind: "people", filter: f }));
  return (
    <div className="pf-phone">
      <StatusBar />
      <div className="pf-largetitle">
        <h1>People</h1>
        <Quilt people={HOME.people} size={44} />
      </div>
      <div className="pf-chips">
        <button className="pf-chip" data-bot="filter-all" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          <span>Everyone</span>
        </button>
        <button className="pf-chip" data-bot="filter-your-move" aria-pressed={filter === "yourMove"} onClick={() => setFilter("yourMove")}>
          <span>
            Your move <b>{mine.length}</b>
          </span>
        </button>
      </div>
      <div className="pf-scroll">
        {filter === "all" && <UsCard s={s} store={store} />}
        {filter === "all" && (
          <>
            <div className="pf-section">Tonight</div>
            <button className="pf-row" data-bot="open-game-night" onClick={() => store.update(go({ kind: "game-night" }))}>
              <Quilt people={SEAT_PATCHES} size={50} />
              <span className="pf-row-main">
                <span className="pf-row-top">
                  <span className="pf-name">Friday game night</span>
                  <span className="pf-time" style={{ color: "var(--pine)", fontWeight: 700 }}>
                    at 8:00
                  </span>
                </span>
                <span className="pf-row-line">The Okafors are in · Nana &amp; Pop roll first</span>
                <span className="pf-row-game">Hearthisle · turn 14 · 3 homes</span>
              </span>
            </button>
          </>
        )}
        <div className="pf-section">
          <span>Your move</span>
          <em>{mine.length}</em>
        </div>
        {mine.map((d) => (
          <DuelRow key={d.id} d={d} store={store} />
        ))}
        {filter === "all" && (
          <>
            <div className="pf-section">Their move</div>
            {theirs.map((d) => (
              <DuelRow key={d.id} d={d} store={store} />
            ))}
            <div className="pf-section">Earlier</div>
            {done.map((d) => (
              <DuelRow key={d.id} d={d} store={store} />
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
      <TabBar current="people" badge={mine.length} onTab={(t) => tabTo(store, t)} />
    </div>
  );
}
