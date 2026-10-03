// Word Duel's own list of games (the game's web view, inside the spine): one per opponent,
// grouped by whose move it is. The spine's turn count and this list read the same reports.
import type { Store } from "../../../harness/store";
import { gameById, type DuelGame } from "../../../world";
import { ChevronLeft, PlusGlyph } from "../glyphs";
import { skinOf, skinVars } from "../skin";
import type { S } from "../state";

const ago = (iso: string) => {
  const mins = Math.round((new Date("2026-10-03T19:12:00-07:00").getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
};

export function DuelList({ s, store }: { s: S; store: Store<S> }) {
  const g = gameById("word-duel");
  const k = skinOf(g);
  const groups: { title: string; items: DuelGame[]; kind: "yours" | "theirs" | "over" }[] = [
    { title: "Your turn", items: s.duel.games.filter((d) => d.status === "yourTurn"), kind: "yours" },
    { title: "Their turn", items: s.duel.games.filter((d) => d.status === "waiting"), kind: "theirs" },
    { title: "Finished", items: s.duel.games.filter((d) => d.status === "completed" || d.status === "expired"), kind: "over" },
  ];
  const justPlayed = s.duel.played ? s.duel.openId : undefined;

  return (
    <div style={{ ...skinVars(k), height: "100%", background: k.ground, color: k.ink, fontFamily: k.body, padding: "48px 0 0", animation: "sp-fade .3s both", overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px 0 6px" }}>
        <button data-bot="duel-deck" aria-label="Back to the deck" onClick={() => store.update((x) => ({ ...x, phone: "deck" }))} style={{ width: 44, height: 44, display: "grid", placeItems: "center", color: k.ink }}>
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ margin: 0, flex: 1, font: `900 27px/1 ${k.display}`, letterSpacing: "-0.02em" }}>Word Duel</h1>
        <button data-bot="duel-new" onClick={() => store.update((x) => ({ ...x, phone: "duel-new" }))} style={{ height: 44, padding: "0 14px", borderRadius: 4, boxShadow: `inset 0 0 0 2px ${k.ink}`, font: `700 15px ${k.body}`, display: "flex", alignItems: "center", gap: 6, color: k.ink }}>
          <PlusGlyph size={16} /> New game
        </button>
      </header>

      {groups.map((grp) =>
        grp.items.length === 0 ? null : (
          <section key={grp.title} style={{ marginTop: 14 }}>
            <h2 style={{ margin: "0 20px 6px", font: `800 13px ${k.body}`, letterSpacing: "0.08em", textTransform: "uppercase", color: grp.kind === "yours" ? "#1d55a8" : "#5d584c" }}>
              {grp.title} · {grp.items.length}
            </h2>
            <div style={{ borderTop: "1px solid #d8d0bf" }}>
              {grp.items.map((d) => (
                <Row key={d.id} d={d} kind={grp.kind} fresh={d.id === justPlayed} onOpen={() => store.update((x) => ({ ...x, phone: "duel-board", duel: { ...x.duel, openId: d.id, placed: 0, played: false } }))} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}

function Row({ d, kind, fresh, onOpen }: { d: DuelGame; kind: "yours" | "theirs" | "over"; fresh: boolean; onOpen: () => void }) {
  const yours = kind === "yours";
  const lead = d.you - d.them;
  return (
    <button
      data-bot={`duel-${d.opponent.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: yours ? "12px 18px 12px 16px" : "9px 18px 9px 16px",
        borderBottom: "1px solid #d8d0bf", background: fresh ? "#e6eefb" : yours ? "#fffdf8" : "transparent",
        boxShadow: yours ? "inset 4px 0 0 #2f6fc8" : "none", animation: fresh ? "sp-rise .5s both" : undefined,
      }}
    >
      <span aria-hidden style={{ width: yours ? 40 : 34, height: yours ? 40 : 34, flex: "none", borderRadius: 4, background: d.color, transform: "rotate(-3deg)", boxShadow: "inset 0 -3px 0 rgba(0,0,0,.22), inset 0 2px 0 rgba(255,255,255,.3)" }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", font: `${yours ? 800 : 700} ${yours ? 18 : 16}px/1.2 'Libre Franklin'`, color: "#1d1b16" }}>
          {d.opponent} <span style={{ fontWeight: 500, fontSize: 14, color: "#5d584c" }}>{d.opponentHome}</span>
        </span>
        <span style={{ display: "block", font: "500 14px/1.3 'Libre Franklin'", color: d.status === "expired" ? "#8a3a2a" : "#45413a" }}>
          {fresh ? `${d.lastMove} · just now` : d.lastMove}
        </span>
      </span>
      <span style={{ textAlign: "right", flex: "none" }}>
        <span style={{ display: "block", font: "800 16px/1.2 'Libre Franklin'", fontVariantNumeric: "tabular-nums", color: "#1d1b16" }}>
          {d.you}–{d.them}
        </span>
        <span style={{ display: "block", font: "500 13px/1.3 'Libre Franklin'", color: lead >= 0 ? "#1f6b3a" : "#8a3a2a" }}>
          {d.status === "completed" ? "Won" : d.status === "expired" ? "Closed" : lead >= 0 ? `Up ${lead}` : `Down ${-lead}`} · {ago(d.updatedAt)}
        </span>
      </span>
    </button>
  );
}
