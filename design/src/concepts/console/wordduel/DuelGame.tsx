// One Word Duel game: the board, your rack, play. Placement is stubbed: a tapped tile goes to the
// next highlighted square.
import type { Store } from "../../../harness/store";
import { playDuel, RACK, type S } from "../state";
import { StatusBar } from "../ui/Brand";
import { Chevron } from "../ui/Icons";
import { BOARD, POINTS, PREMIUM, SIZE, SLOTS } from "./board";
import { DuelPlayed } from "./DuelPlayed";

export function DuelGameView({ s, store }: { s: S; store: Store<S> }) {
  const d = s.duels.find((x) => x.id === s.duel.open);
  if (!d) return null;
  if (s.duel.result === "played") return <DuelPlayed s={s} store={store} />;
  const placed = s.duel.placed;
  const word = [...placed, "E"].join("");
  const ready = placed.length === SLOTS.length;
  const score = 27;
  const used = new Set<number>();
  // Map each placed letter back to one rack index, so a rack letter leaves the rack once.
  for (const ch of placed) {
    const i = RACK.findIndex((x, k) => x === ch && !used.has(k));
    if (i >= 0) used.add(i);
  }
  const place = (i: number) =>
    store.update((x) => {
      if (x.duel.placed.length >= SLOTS.length) return x;
      const ch = RACK[i];
      if (!ch) return x;
      return { ...x, duel: { ...x.duel, placed: [...x.duel.placed, ch], result: null } };
    });
  const recall = () => store.update((x) => ({ ...x, duel: { ...x.duel, placed: [], result: null } }));
  return (
    <div className="wd wd--game">
      <StatusBar />
      <div className="wd-top">
        <button className="cx-back" data-bot="duel-back" onClick={() => store.update((x) => ({ ...x, phone: "duels", duel: { open: null, placed: [], result: null } }))}>
          <Chevron size={20} dir="left" /> Games
        </button>
        <span className="wd-vs">
          <b>
            <i style={{ background: d.color }} />
            {d.opponent}
          </b>
          <span>{d.opponentHome}</span>
        </span>
      </div>
      <div className="wd-score">
        <div>
          <span>You</span>
          <b>{d.you}</b>
        </div>
        <p>{d.lastMove}</p>
        <div>
          <span>{d.opponent}</span>
          <b>{d.them}</b>
        </div>
      </div>
      <div className="wd-board" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }} aria-label="Board">
        {Array.from({ length: SIZE * SIZE }, (_, k) => {
          const r = Math.floor(k / SIZE);
          const c = k % SIZE;
          const cell = BOARD.find((x) => x.r === r && x.c === c);
          const slot = SLOTS.findIndex((x) => x.r === r && x.c === c);
          const mine = slot >= 0 ? placed[slot] : undefined;
          const prem = PREMIUM.find((x) => x.r === r && x.c === c);
          if (cell) return <span key={k} className={`wd-sq wd-tile ${cell.last ? "is-last" : ""}`}><span>{cell.ch}</span></span>;
          if (mine) return <span key={k} className="wd-sq wd-tile is-mine"><span>{mine}</span></span>;
          if (slot >= 0 && slot === placed.length) return <span key={k} className="wd-sq is-next" />;
          if (prem) return <span key={k} className={`wd-sq wd-prem wd-prem--${prem.kind}`}><span>{prem.kind}</span></span>;
          return <span key={k} className={`wd-sq ${slot >= 0 ? "is-slot" : ""}`} />;
        })}
      </div>
      {s.duel.result === "invalid" ? (
        <div className="wd-msg wd-msg--err" role="alert">
          <b>{word} isn't in the word list.</b>
          <span>Nothing was played. Your tiles are still yours.</span>
        </div>
      ) : (
        <div className="wd-msg">
          {ready ? (
            <>
              <b>
                {word} · {score} points
              </b>
              <span>Triple word on the C.</span>
            </>
          ) : (
            <span>Tap tiles to fill the glowing squares.</span>
          )}
        </div>
      )}
      <div className="wd-rack">
        {RACK.map((ch, i) => (
          <button key={i} className={`wd-tile wd-rack__tile ${used.has(i) ? "is-used" : ""}`} data-bot={`rack-${ch}`} disabled={used.has(i)} onClick={() => place(i)} aria-label={`Tile ${ch}`}>
            <span>{ch}</span>
            <sub>{POINTS[ch]}</sub>
          </button>
        ))}
      </div>
      <div className="wd-actions">
        <button className="cx-btn cx-btn--ghost" data-bot="recall" onClick={recall} disabled={placed.length === 0}>
          <span>{s.duel.result === "invalid" ? "Take tiles back" : "Clear"}</span>
        </button>
        <button className="cx-btn cx-btn--primary wd-play" data-bot="play" disabled={!ready || s.duel.result === "invalid"} onClick={() => store.update(playDuel)}>
          <span>{ready ? `Play ${word}` : "Play"}</span>
        </button>
      </div>
    </div>
  );
}
