// A duel row's face: the opponent's sticker standing on a tiny board of that game, so every duel
// looks like itself (not the same crop five times). Every opponent has a sticker (the world data
// carries it), so people outside the family's homes are characters too, never an initial.
import { HOUSEHOLDS, type DuelGame, type Person } from "../../../world";
import { Sticker } from "../ui/Sticker";

export function opponentOf(d: DuelGame): Person | undefined {
  for (const h of HOUSEHOLDS) {
    const p = h.people.find((x) => x.name === d.opponent);
    if (p) return p;
  }
  return undefined;
}

const hash = (s: string): number => [...s].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) % 1009, 7);

/** A 7×7 board with the duel's last word on it, laid out from the duel's id (stable per game). */
function cells(d: DuelGame): { r: number; c: number; last: boolean }[] {
  const h = hash(d.id);
  const word = d.lastWord ?? "WORD";
  const across = h % 2 === 0;
  const len = Math.min(word.length, 6);
  const r0 = across ? 1 + (h % 4) : 0;
  const c0 = across ? 0 : 1 + (h % 5);
  const out = [...Array(len).keys()].map((i) => ({ r: across ? r0 : r0 + i, c: across ? c0 + i : c0, last: true }));
  // A few older tiles crossing it.
  const k = 2 + (h % 3);
  for (let i = 0; i < k; i++) {
    const r = across ? r0 + 1 + i : (h + i * 3) % 7;
    const c = across ? (h + i * 2) % 7 : c0 + 1 + i;
    if (r < 7 && c < 7) out.push({ r, c, last: false });
  }
  return out;
}

export function MiniBoard({ d, size = 52 }: { d: DuelGame; size?: number }) {
  const q = size / 7;
  const finished = d.status === "completed" || d.status === "expired";
  return (
    <svg className="wd-mini" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <rect width={size} height={size} rx={8} fill="#f4efe4" />
      {cells(d).map((x, i) => (
        <rect key={i} x={x.c * q + 0.8} y={x.r * q + 0.8} width={q - 1.6} height={q - 1.6} rx={1.4} fill={x.last && !finished ? "#2f6fc8" : "#fffaf0"} stroke="#cdbf9f" strokeWidth={0.6} />
      ))}
    </svg>
  );
}

export function OpponentMark({ d, size = 30 }: { d: DuelGame; size?: number }) {
  return <Sticker person={opponentOf(d) ?? { id: d.id, sticker: d.sticker }} size={size} />;
}

/** Sticker on its tiny board: the row art for a duel. */
export function DuelFace({ d, size = 52 }: { d: DuelGame; size?: number }) {
  return (
    <span className="wd-face" style={{ width: size, height: size }}>
      <MiniBoard d={d} size={size} />
      <span className="wd-face__who">
        <OpponentMark d={d} size={size * 0.66} />
      </span>
    </span>
  );
}
