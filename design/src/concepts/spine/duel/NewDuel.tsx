// New Word Duel: pick a person from the households you already play with. One game per opponent,
// so people you're already playing show where that game stands instead of a second game.
import type { Store } from "../../../harness/store";
import { HOUSEHOLDS, gameById } from "../../../world";
import { ChevronLeft, PlusGlyph } from "../glyphs";
import { skinOf, skinVars } from "../skin";
import type { S } from "../state";

export function NewDuel({ s, store }: { s: S; store: Store<S> }) {
  const k = skinOf(gameById("word-duel"));
  const open = new Map(s.duel.games.filter((d) => d.status === "yourTurn" || d.status === "waiting").map((d) => [d.opponent, d]));
  const people = HOUSEHOLDS.flatMap((h) => h.people.filter((p) => p.band === "grownup" && p.id !== "dad").map((p) => ({ p, h })));
  return (
    <div style={{ ...skinVars(k), height: "100%", background: k.ground, color: k.ink, padding: "48px 0 0", animation: "sp-rise .3s both" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 16px 0 4px" }}>
        <button data-bot="new-back" onClick={() => store.update((x) => ({ ...x, phone: "duel-list" }))} style={{ height: 44, padding: "0 8px", display: "flex", alignItems: "center", gap: 2, font: "600 16px 'Libre Franklin'", color: "#1d55a8" }}>
          <ChevronLeft size={20} /> Games
        </button>
      </header>
      <h1 style={{ margin: "8px 20px 4px", font: "900 27px/1.1 'Libre Franklin'" }}>Who’s your next duel?</h1>
      <p style={{ margin: "0 20px 14px", font: "500 15px/1.35 'Libre Franklin'", color: "#45413a" }}>People from homes you already play with. One game each; they get a push, never their kids.</p>
      <div style={{ borderTop: "1px solid #d8d0bf" }}>
        {people.map(({ p, h }) => {
          const g = open.get(p.name);
          return (
            <button key={p.id} data-bot={`new-${p.id}`} disabled={!!g} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 58, padding: "8px 20px", borderBottom: "1px solid #d8d0bf", textAlign: "left", background: "transparent" }}>
              <span aria-hidden style={{ width: 32, height: 32, borderRadius: 4, background: p.color, transform: "rotate(-3deg)", flex: "none", boxShadow: "inset 0 -3px 0 rgba(0,0,0,.22)" }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", font: "700 17px/1.2 'Libre Franklin'", color: "#1d1b16" }}>{p.name}</span>
                <span style={{ display: "block", font: "500 14px/1.3 'Libre Franklin'", color: "#45413a" }}>{h.id === "hh-mumm" ? "Home" : `${h.name} · ${h.city}`}</span>
              </span>
              <span style={{ font: "700 14px 'Libre Franklin'", color: g ? "#45413a" : "#1d55a8" }}>{g ? (g.status === "yourTurn" ? "Your turn there" : "Game on") : "Start"}</span>
            </button>
          );
        })}
        <button data-bot="new-invite" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 58, padding: "8px 20px", textAlign: "left", color: "#1d55a8", font: "700 17px 'Libre Franklin'" }}>
          <PlusGlyph /> Invite someone new
        </button>
      </div>
    </div>
  );
}
