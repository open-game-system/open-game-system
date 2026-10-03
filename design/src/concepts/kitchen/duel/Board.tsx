// One duel: the score, the last move, the board, your rack. Tapping a rack tile drops it into the
// next highlighted square (a design stub for drag-to-place).
import type { Store } from "../../../harness/store";
import { StatusBar } from "../ui/Bits";
import { Check, Chevron } from "../ui/Icons";
import { MOVE, playMove, type S } from "../state";
import { ago } from "./List";
import { PREMIUM, POINTS, RACK, SIZE, SLOTS, TILES } from "./boardData";

const LABEL: Record<string, string> = { tw: "3W", dw: "2W", tl: "3L", dl: "2L", star: "" };

export function DuelBoard({ s, store }: { s: S; store: Store<S> }) {
  const d = s.duels.find((x) => x.id === s.openDuel);
  if (!d) return null;
  const mine = d.status === "yourTurn" || s.sent;
  const word = `L${s.placed.join("")}`;
  const ready = s.placed.length === SLOTS.length;
  const used = new Set<number>();
  for (const ch of s.placed) used.add(RACK.findIndex((r, i) => r === ch && !used.has(i)));
  const nextTurn = s.duels.find((x) => x.status === "yourTurn" && x.id !== d.id);
  return (
    <div className="pl pl-phone pl-duel">
      <StatusBar time={s.clock} />
      <div className="pl-navbar">
        <button
          className="pl-back"
          data-bot="all-games"
          onClick={() => store.update((x) => ({ ...x, phone: "duels", openDuel: null, placed: [], sent: false }))}
        >
          <span>
            {" "}
            <Chevron dir="left" size={18} /> All games
          </span>
        </button>
        <span className="pl-navbar-title">
          {d.opponent} <span>· {d.opponentHome}</span>
        </span>
      </div>
      <div className="pl-duel-score">
        <span className="pl-duel-you">
          <span>You</span>
          <b>{d.you}</b>
        </span>
        <span className="pl-duel-them" style={{ borderColor: d.color }}>
          <span>{d.opponent}</span>
          <b>{d.them}</b>
        </span>
      </div>
      <p className="pl-duel-lastline">
        {s.sent ? `You played ${MOVE.word} for ${MOVE.score}` : d.lastMove} · {s.sent ? "just now" : ago(d.updatedAt)}
      </p>
      <div className="pl-grid" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          const t = TILES.find((x) => x.r === r && x.c === c);
          const slot = SLOTS.findIndex((x) => x.r === r && x.c === c);
          const placed = slot >= 0 ? s.placed[slot] : undefined;
          const prem = PREMIUM[`${r},${c}`];
          if (t)
            return (
              <span key={i} className={`pl-cell pl-cell--tile${t.last && !s.sent ? " pl-cell--last" : ""}`}>
                {t.ch}
              </span>
            );
          if (placed)
            return (
              <span key={i} className={`pl-cell pl-cell--tile pl-cell--mine${s.sent ? " pl-cell--sent" : ""}`}>
                {placed}
              </span>
            );
          if (slot >= 0 && mine && !s.sent) return <span key={i} className={`pl-cell pl-cell--slot${slot === s.placed.length ? " pl-cell--next" : ""}`} />;
          return (
            <span key={i} className={`pl-cell${prem ? ` pl-cell--${prem}` : ""}`}>
              {prem ? LABEL[prem] : ""}
            </span>
          );
        })}
      </div>
      {s.sent ? (
        <div className="pl-duel-sent" role="status">
          <p>
            <Check size={20} /> <b>Sent to {d.opponent}.</b> We'll tell you when it's your move again.
          </p>
          {nextTurn ? (
            <button
              className="pl-btn pl-btn--primary pl-wide"
              data-bot="next-turn"
              onClick={() => store.update((x) => ({ ...x, openDuel: nextTurn.id, placed: [], sent: false }))}
            >
              <span> Next: your move with {nextTurn.opponent}</span>
            </button>
          ) : null}
        </div>
      ) : mine ? (
        <>
          <div className="pl-rack">
            {RACK.map((ch, i) => (
              <button
                key={i}
                className={`pl-rack-tile${used.has(i) ? " pl-rack-tile--used" : ""}`}
                data-bot={`tile-${ch}`}
                disabled={used.has(i) || ready}
                onClick={() => store.update((x) => ({ ...x, placed: [...x.placed, ch] }))}
              >
                {ch}
                <sub>{POINTS[ch]}</sub>
              </button>
            ))}
          </div>
          <div className="pl-row pl-duel-actions">
            <button
              className="pl-btn pl-btn--secondary"
              data-bot="clear"
              disabled={s.placed.length === 0}
              onClick={() => store.update((x) => ({ ...x, placed: [] }))}
            >
              <span> Clear</span>
            </button>
            <button className="pl-btn pl-btn--primary pl-grow" data-bot="play-move" disabled={!ready} onClick={() => store.update(playMove)}>
              <span> {ready ? `Play ${word} · ${word === MOVE.word ? MOVE.score : 0}` : "Tap tiles to place them"}</span>
            </button>
          </div>
        </>
      ) : (
        <p className="pl-duel-wait">{d.status === "waiting" ? `${d.opponent}'s move. We'll let you know.` : d.lastMove}</p>
      )}
    </div>
  );
}
