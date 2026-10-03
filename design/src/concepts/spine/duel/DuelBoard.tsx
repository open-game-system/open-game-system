// Word Duel's board (stand-in for the game's own view): tap rack tiles to place them below the T
// of QUILT, then play. The board is simple on purpose; the list and the spine are the design.
import type { Store } from "../../../harness/store";
import { gameById } from "../../../world";
import { ChevronLeft } from "../glyphs";
import { skinOf, skinVars } from "../skin";
import { playMove } from "../session";
import { PLAY, RACK, type S } from "../state";

const PTS: Record<string, number> = { Q: 10, U: 1, I: 1, L: 1, T: 1, W: 4, O: 1, H: 4, M: 3, D: 2, E: 1, R: 1, N: 1, A: 1, S: 1 };
type Cell = { r: number; c: number; l: string };
const WORDS: Cell[] = [
  ..."QUILT".split("").map((l, i) => ({ r: 4, c: 2 + i, l })),
  ..."WOO".split("").map((l, i) => ({ r: 1 + i, c: 5, l })),
  { r: 3, c: 3, l: "H" },
  { r: 5, c: 3, l: "M" },
];
const NANA_LAST = new Set(["4,2", "4,3", "4,4", "4,5", "4,6"]);
const SLOTS = PLAY.tiles.map((l, i) => ({ r: 5 + i, c: 6, l }));
const BONUS: Record<string, { label: string; bg: string; fg: string }> = {
  "0,0": { label: "3W", bg: "#e98a63", fg: "#3a1408" }, "0,10": { label: "3W", bg: "#e98a63", fg: "#3a1408" },
  "10,0": { label: "3W", bg: "#e98a63", fg: "#3a1408" }, "10,10": { label: "3W", bg: "#e98a63", fg: "#3a1408" },
  "1,1": { label: "2W", bg: "#f3c48e", fg: "#4a2a08" }, "9,9": { label: "2W", bg: "#f3c48e", fg: "#4a2a08" }, "6,6": { label: "2W", bg: "#f3c48e", fg: "#4a2a08" },
  "7,6": { label: "3L", bg: "#9cc0ee", fg: "#0f2d55" }, "3,9": { label: "3L", bg: "#9cc0ee", fg: "#0f2d55" }, "8,2": { label: "2L", bg: "#c7dbf5", fg: "#0f2d55" }, "2,8": { label: "2L", bg: "#c7dbf5", fg: "#0f2d55" },
  "5,5": { label: "★", bg: "#f3c48e", fg: "#4a2a08" },
};

export function DuelBoard({ s, store }: { s: S; store: Store<S> }) {
  const g = gameById("word-duel");
  const k = skinOf(g);
  const d = s.duel.games.find((x) => x.id === s.duel.openId);
  if (!d) return null;
  const placed = s.duel.played ? PLAY.tiles.length : s.duel.placed;
  const ready = placed === PLAY.tiles.length && !s.duel.played;
  const nextId = s.duel.games.find((x) => x.status === "yourTurn" && x.id !== d.id)?.id;
  const next = s.duel.games.find((x) => x.id === nextId);
  const used = PLAY.tiles.slice(0, placed);
  const rack = RACK.map((l) => ({ l, gone: used.includes(l) }));
  const place = (l: string) =>
    store.update((x) => (PLAY.tiles[x.duel.placed] === l ? { ...x, duel: { ...x.duel, placed: x.duel.placed + 1 } } : x));

  const at = (r: number, c: number) => {
    const w = WORDS.find((x) => x.r === r && x.c === c);
    if (w) return { l: w.l, kind: NANA_LAST.has(`${r},${c}`) ? "last" : "old" };
    const slot = SLOTS.findIndex((x) => x.r === r && x.c === c);
    if (slot >= 0 && slot < placed) return { l: SLOTS[slot]?.l ?? "", kind: s.duel.played ? "mine" : "new" };
    if (slot >= 0) return { l: "", kind: "ghost" };
    return undefined;
  };

  return (
    <div style={{ ...skinVars(k), height: "100%", background: k.ground, color: k.ink, fontFamily: k.body, padding: "48px 0 0", position: "relative", animation: "sp-fade .3s both" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 16px 0 4px" }}>
        <button data-bot="duel-back" onClick={() => store.update((x) => ({ ...x, phone: "duel-list" }))} style={{ height: 44, padding: "0 8px", display: "flex", alignItems: "center", gap: 2, font: "600 16px 'Libre Franklin'", color: "#1d55a8" }}>
          <ChevronLeft size={20} /> Games
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ font: "800 16px 'Libre Franklin'", fontVariantNumeric: "tabular-nums" }}>
          You {d.you + (s.duel.played ? 0 : 0)} <span style={{ color: "#8a8270", fontWeight: 500 }}>·</span> {d.opponent} {d.them}
        </span>
      </header>
      <div style={{ padding: "6px 20px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 14, height: 14, borderRadius: 3, background: d.color, flex: "none" }} />
        <span style={{ font: "500 15px/1.3 'Libre Franklin'", color: "#45413a" }}>
          {s.duel.played ? `You played ${PLAY.word} for ${PLAY.score}. ${d.opponent}’s move.` : `${d.lastMove} · 25 min ago`}
        </span>
      </div>

      <div style={{ margin: "0 auto", width: 358, display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 2, padding: 3, background: "#d8cfbb", borderRadius: 4 }}>
        {Array.from({ length: 121 }, (_, i) => {
          const r = Math.floor(i / 11);
          const c = i % 11;
          const t = at(r, c);
          const b = BONUS[`${r},${c}`];
          if (t && t.kind !== "ghost") {
            const bg = t.kind === "new" ? "#2f6fc8" : t.kind === "mine" ? "#fff6dc" : "#fff6dc";
            const fg = t.kind === "new" ? "#ffffff" : "#1d1b16";
            return (
              <span key={i} style={{ aspectRatio: "1", borderRadius: 3, background: bg, color: fg, display: "grid", placeItems: "center", font: "800 17px 'Libre Franklin'", boxShadow: t.kind === "last" ? `inset 0 0 0 2px ${d.color}` : t.kind === "mine" ? "inset 0 0 0 2px #2f6fc8" : "inset 0 -2px 0 rgba(0,0,0,.18)", position: "relative", animation: t.kind === "new" ? "sp-pop .3s both" : undefined }}>
                {t.l}
              </span>
            );
          }
          return (
            <span key={i} style={{ aspectRatio: "1", borderRadius: 2, background: t ? "#efe8d8" : b?.bg ?? "#ece4d3", outline: t ? "2px dashed #2f6fc8" : "none", outlineOffset: -3, color: b?.fg, display: "grid", placeItems: "center", font: "800 10px 'Libre Franklin'" }}>
              {t ? "" : b?.label}
            </span>
          );
        })}
      </div>

      {s.duel.played ? (
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 18, display: "grid", gap: 10 }}>
          <div style={{ textAlign: "center", font: "900 40px/1 'Libre Franklin'", color: "#1d55a8", animation: "sp-pop .4s both" }}>+{PLAY.score}</div>
          {next && (
            <button data-bot="duel-next" onClick={() => store.update((x) => ({ ...x, duel: { ...x.duel, openId: next.id, placed: 0, played: false } }))} style={{ height: 56, borderRadius: 4, background: "#2f6fc8", color: "#fff", font: "800 18px 'Libre Franklin'" }}>
              Next: {next.opponent}’s turn
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
            {rack.map((t, i) => (
              <button
                key={i}
                data-bot={`tile-${t.l}`}
                onClick={() => place(t.l)}
                aria-label={`Tile ${t.l}`}
                disabled={t.gone}
                style={{ width: 46, height: 52, borderRadius: 4, background: t.gone ? "transparent" : "#fff6dc", boxShadow: t.gone ? "inset 0 0 0 2px #d8cfbb" : "inset 0 -3px 0 #d8c9a3, 0 2px 4px rgba(0,0,0,.12)", font: "800 22px 'Libre Franklin'", color: "#1d1b16", position: "relative" }}
              >
                {t.gone ? "" : t.l}
                {!t.gone && <span style={{ position: "absolute", right: 5, bottom: 4, font: "700 11px 'Libre Franklin'", color: "#45413a" }}>{PTS[t.l] ?? 1}</span>}
              </button>
            ))}
          </div>
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 18 }}>
            <button
              data-bot="duel-play"
              disabled={!ready}
              onClick={() => store.update(playMove)}
              style={{ width: "100%", height: 56, borderRadius: 4, background: ready ? "#2f6fc8" : "#ddd5c4", color: ready ? "#fff" : "#4d483e", font: "800 18px 'Libre Franklin'" }}
            >
              {ready ? `Play ${PLAY.word} · ${PLAY.score}` : placed ? `${PLAY.word.slice(0, placed + 1)}…` : "Tap tiles to place them"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
