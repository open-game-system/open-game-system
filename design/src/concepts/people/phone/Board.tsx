// Word Duel's board with Nana (a design-only stand-in): 11 × 11, QUILT just played.
const N = 11;
const WORDS: { word: string; r: number; c: number; down: boolean }[] = [
  { word: "AQUA", r: 6, c: 2, down: true },
  { word: "QUILT", r: 7, c: 2, down: false },
  { word: "TOES", r: 7, c: 6, down: true },
  { word: "SEA", r: 10, c: 6, down: false },
  { word: "MOW", r: 4, c: 8, down: true },
  { word: "OWE", r: 5, c: 8, down: false },
];
const LAST = new Set(["7,2", "7,3", "7,4", "7,5", "7,6"]); // QUILT, Nana's last move
/** Where this turn's tiles go: H A Z E down column 5, hooking the L of QUILT. */
export const SLOTS = ["3,5", "4,5", "5,5", "6,5"];

const POINTS: Record<string, number> = { A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1, D: 2, G: 2, B: 3, C: 3, M: 3, P: 3, F: 4, H: 4, V: 4, W: 4, Y: 4, K: 5, J: 8, X: 8, Q: 10, Z: 10 };
export const points = (l: string) => POINTS[l] ?? 1;

const letters = new Map<string, string>();
for (const w of WORDS) [...w.word].forEach((ch, i) => letters.set(`${w.down ? w.r + i : w.r},${w.down ? w.c : w.c + i}`, ch));

function premium(r: number, c: number): "tw" | "dw" | "tl" | "star" | undefined {
  if (r === 5 && c === 5) return "star";
  const e = (x: number) => x === 0 || x === 10;
  if ((e(r) && (e(c) || c === 5)) || (e(c) && r === 5)) return "tw";
  if (r === c || r + c === 10) return "dw";
  if ((r % 4 === 1 && c % 4 === 1) || (r % 4 === 3 && c % 4 === 3)) return "tl";
  return undefined;
}

export function Board({ placed, played }: { placed: string[]; played: boolean }) {
  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const key = `${r},${c}`;
      const slot = SLOTS.indexOf(key);
      const mine = slot >= 0 ? (played ? "HAZE"[slot] : placed[slot]) : undefined;
      const ch = letters.get(key) ?? mine;
      const kind = premium(r, c);
      const cls = ch ? `pf-cell tile${mine ? " mine" : ""}${LAST.has(key) && !played ? " last" : ""}` : `pf-cell${kind ? ` ${kind}` : ""}${slot >= 0 && !played && placed.length === slot ? " next" : ""}`;
      cells.push(
        <div key={key} className={cls}>
          {ch && (
            <>
              <span>{ch}</span>
              <i>{points(ch)}</i>
            </>
          )}
        </div>,
      );
    }
  }
  return <div className="pf-board" aria-label="Word Duel board">{cells}</div>;
}
