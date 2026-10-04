// A Word Duel turn picked from the TV's cork board is played here, on the phone: the tiles are
// yours, so the room only sees the note come down and go back up.
import { DUELS } from "../../../world";
import { home, playWord } from "../actions";
import type { S } from "../state";

type Act = (fn: (s: S) => S) => void;

const RACK = ["O", "A", "R", "S", "E", "M", "N"];
const SIZE = 11;
const ROW = 5;
const COL = 3;

function Board({ word, placed }: { word: string; placed: string[] }) {
  const cells: { k: string; ch: string; kind: "" | "is-old" | "is-new" | "is-star" }[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      let ch = "";
      let kind: "" | "is-old" | "is-new" | "is-star" = "";
      if (r === ROW && c >= COL && c < COL + word.length) {
        ch = word[c - COL] ?? "";
        kind = "is-old";
      }
      const anchor = COL + word.length - 1;
      if (c === anchor && r > ROW && r - ROW - 1 < placed.length) {
        ch = placed[r - ROW - 1] ?? "";
        kind = "is-new";
      }
      if (!ch && r === 5 && c === 5) kind = "is-star";
      cells.push({ k: `${r}-${c}`, ch, kind });
    }
  return (
    <div className="cr-board">
      {cells.map((x) => (
        <span key={x.k} className={`cr-cell ${x.kind}`}>
          {x.ch}
        </span>
      ))}
    </div>
  );
}

export function DuelPlay({ s, duelId, act }: { s: S; duelId: string; act: Act }) {
  const d = DUELS.find((x) => x.id === duelId);
  if (!d) return null;
  const word = d.lastWord ?? "";
  const placed = s.tiles.map((i) => RACK[i] ?? "");
  const mine = `${word.slice(-1)}${placed.join("")}`;
  return (
    <div className="cr-duel">
      <div className="cr-duel-head">
        <button type="button" className="cr-backbtn" data-bot="duel-back" onClick={() => act(home)}>
          <span className="cr-glyph-back" />
          Room
        </button>
        <div className="cr-duel-vs">
          <img src={d.sticker} alt="" />
          <div>
            <div className="cr-duel-name">Word Duel with {d.opponent}</div>
            <div className="cr-duel-score">
              You {d.you} · {d.opponent} {d.them}
            </div>
          </div>
        </div>
      </div>
      <div className="cr-duel-last">{d.lastMove}. Your turn</div>
      <Board word={word} placed={placed} />
      <div className="cr-duel-word">{placed.length > 0 ? `${mine}` : "Tap tiles to build down from the T"}</div>
      <div className="cr-rack">
        {RACK.map((ch, i) => {
          const used = s.tiles.includes(i);
          return (
            <button key={ch + i} type="button" className={`cr-tile ${used ? "is-used" : ""}`} data-bot={`tile-${i}`} disabled={used} onClick={() => act((x) => ({ ...x, tiles: [...x.tiles, i] }))}>
              {ch}
            </button>
          );
        })}
      </div>
      <div className="cr-duel-actions">
        <button type="button" className="cr-btn" data-bot="clear" onClick={() => act((x) => ({ ...x, tiles: [] }))}>
          Clear
        </button>
        <button type="button" className="cr-btn is-primary" data-bot="play" disabled={placed.length < 2} onClick={() => act((x) => playWord(x, duelId))}>
          {placed.length < 2 ? "Play" : `Play ${mine}`}
        </button>
      </div>
      <div className="cr-duel-private">The TV only shows the note, never your tiles</div>
    </div>
  );
}
