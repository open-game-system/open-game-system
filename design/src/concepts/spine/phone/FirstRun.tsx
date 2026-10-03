// First run: no household, no TV. The deck is already full of covers (the library); the one
// thing to do is tell OGS who's home, once, so no game ever asks again.
import type { Store } from "../../../harness/store";
import { allGames } from "../session";
import { statusOf } from "../covers";
import type { S } from "../state";
import { ShelfCover } from "./Deck";

export function FirstRun({ s, store }: { s: S; store: Store<S> }) {
  return (
    <div style={{ height: "100%", background: "var(--sp-paper)", padding: "50px 16px 0" }}>
      <h1 style={{ margin: "0 0 12px", font: "700 30px/1 var(--sp-font)", color: "var(--sp-ink)", letterSpacing: "-0.02em" }}>Your games</h1>
      <section className="sp-stitch-top" style={{ background: "var(--sp-ink)", color: "var(--sp-bone)", borderRadius: 16, padding: "22px 18px 18px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ width: 34, height: 34, borderRadius: 17, border: "2px dashed rgba(239,231,214,.5)" }} />
          ))}
        </div>
        <div style={{ font: "700 22px/1.15 var(--sp-font)" }}>Who’s home?</div>
        <p style={{ margin: "6px 0 14px", font: "500 15px/1.4 var(--sp-font)", color: "var(--sp-dim)" }}>
          Add your family once. Every game knows who’s who, and each kid’s iPad follows the TV by name.
        </p>
        <button data-bot="first-family" className="sp-ogs-btn" style={{ background: "var(--sp-bone)", color: "var(--sp-ink)" }} onClick={() => store.update((x) => ({ ...x, firstRun: false, phone: "deck" }))}>
          <span>Add your family</span>
        </button>
      </section>
      <div style={{ font: "600 15px var(--sp-font)", color: "var(--sp-ink)", margin: "16px 0 8px" }}>The library · 7 games</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {allGames().slice(0, 6).map((g) => (
          <ShelfCover key={g.id} g={g} st={statusOf(g, s)} onOpen={() => undefined} />
        ))}
      </div>
    </div>
  );
}
