// A one-to-one thread. The board is the conversation; the rack is the composer; a move is a message.
import { HEARTHISLE, type DuelGame } from "../../../world";
import type { Store } from "../../../harness/store";
import { go, placeTile, playMove, recallTiles, RACK, WORD_SLOTS, HAZEL_SCORE, type S } from "../state";
import { NavBar, StatusBar } from "../ui/Chrome";
import { Patch, Quilt } from "../ui/Patch";
import { when } from "../ui/time";
import { Board, points } from "./Board";
import { opponent, SEAT_PATCHES } from "./PeopleHome";

function Composer({ s, store, d }: { s: S; store: Store<S>; d: DuelGame }) {
  const word = s.placed.map((i) => RACK[i] ?? "").join("") + "L";
  const ready = s.placed.length === WORD_SLOTS;
  const valid = ready && word === "HAZEL";
  return (
    <div className="pf-composer">
      <div className="pf-rack">
        {RACK.map((l, i) => {
          const used = s.placed.includes(i);
          return (
            <button key={i} className={`pf-racktile${used ? " used" : ""}`} data-bot={`tile-${i}`} aria-label={`Tile ${l}`} disabled={used} onClick={() => store.update(placeTile(i))}>
              {!used && (
                <>
                  <span>{l}</span>
                  <i>{points(l)}</i>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="pf-composer-row">
        <button className="pf-secondary" data-bot="recall" onClick={() => store.update(recallTiles)} disabled={s.placed.length === 0}>
          Clear
        </button>
        <button className="pf-primary" style={{ flex: 1, width: "auto" }} data-bot="play" disabled={!valid} onClick={() => store.update(playMove(d.id))}>
          <span>{valid ? `Play HAZEL · ${HAZEL_SCORE}` : ready ? "Not a word yet" : "Tap tiles to spell"}</span>
        </button>
      </div>
    </div>
  );
}

function Sent({ store, next }: { store: Store<S>; next?: DuelGame }) {
  return (
    <div className="pf-composer sent">
      <p className="pf-sent-line">Sent. We'll tell you when Nana plays; nothing else will ping you.</p>
      {next ? (
        <button className="pf-primary" data-bot="next-your-move" onClick={() => store.update(go({ kind: "duel", duelId: next.id, from: "people" }))}>
          <Patch person={opponent(next)} size={28} /> <span>Next: your move with {next.opponent}</span>
        </button>
      ) : null}
    </div>
  );
}

export function DuelThread({ s, store, duelId, from }: { s: S; store: Store<S>; duelId: string; from: "people" | "duels" }) {
  const d = s.duels.find((x) => x.id === duelId);
  if (!d) return null;
  const isNana = d.opponent === "Nana";
  const playedNow = d.lastWord === "HAZEL";
  const next = s.duels.find((x) => x.status === "yourTurn" && x.id !== d.id);
  const back = () => store.update(go(from === "duels" ? { kind: "duels" } : { kind: "people", filter: "all" }));
  return (
    <div className="pf-phone">
      <StatusBar />
      <NavBar
        onBack={back}
        avatar={<Patch person={opponent(d)} size={40} />}
        title={d.opponent}
        sub={`${d.opponentHome} · Word Duel`}
        right={
          <div className="pf-score" aria-label={`You ${d.you}, ${d.opponent} ${d.them}`}>
            <b>{d.you}</b>
            <span>you</span>
            <b>{d.them}</b>
            <span>{d.opponent.split(" ")[0]}</span>
          </div>
        }
      />
      {isNana && (
        <button className="pf-alsowith" data-bot="also-game-night" onClick={() => store.update(go({ kind: "game-night" }))}>
          <Quilt people={SEAT_PATCHES} size={26} />
          <span>Also with Nana: Hearthisle game night at 8 · {HEARTHISLE.turn} roll first</span>
        </button>
      )}
      <div className="pf-duel-timeline">
        {!playedNow && (
        <div className="pf-event mine">
          <div className="pf-bubble">
            <span>
              Played <b>MOW</b> for 22
            </span>
            <small>Thursday</small>
          </div>
        </div>
        )}
        <div className="pf-event">
          <Patch person={opponent(d)} size={28} />
          <div className="pf-bubble">
            <span>
              Played <b>{isNana ? "QUILT" : (d.lastWord ?? "")}</b> for {isNana ? 34 : 18}
            </span>
            <small>{when(isNana ? "2026-10-03T18:47:00-07:00" : d.updatedAt)}</small>
          </div>
        </div>
        {playedNow && (
          <div className="pf-event mine pf-arrive">
            <div className="pf-bubble">
              <span>
                Played <b>HAZEL</b> for {HAZEL_SCORE}
              </span>
              <small>Just now</small>
            </div>
          </div>
        )}
      </div>
      <Board placed={s.placed.map((i) => RACK[i] ?? "")} played={playedNow} />
      {d.status === "yourTurn" && isNana ? (
        <Composer s={s} store={store} d={d} />
      ) : playedNow ? (
        <Sent store={store} next={next} />
      ) : (
        <div className="pf-composer sent">
          <p className="pf-sent-line">{d.status === "yourTurn" ? "Your move." : d.status === "waiting" ? `${d.opponent}'s move. We'll tell you when they play.` : d.lastMove}</p>
        </div>
      )}
    </div>
  );
}
