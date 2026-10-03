// The spine's ledge: the only place OGS interrupts a game on the phone. It grows out of the spine
// in the spine's material, says one thing, and offers one action.
import type { ReactNode } from "react";
import type { Store } from "../../../harness/store";
import { MoonGlyph, TurnGlyph } from "../glyphs";
import { game, instanceOf, undoSwap } from "../session";
import type { S } from "../state";
import { PeopleDots } from "./Spine";

export function Ledge({ s, store }: { s: S; store: Store<S> }) {
  if (s.phone !== "game" || s.swap !== "done") return null;

  if (s.avaAsleep && !s.avaOnJuneau) {
    return (
      <Shell>
        <span style={{ color: "var(--sp-bone)", flex: "none", display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 18, background: "var(--sp-ink2)" }}>
          <MoonGlyph size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", font: "600 15px/1.25 var(--sp-font)", color: "var(--sp-bone)" }}>Ava’s iPad is asleep at 9%</b>
          <span style={{ display: "block", font: "500 13px/1.3 var(--sp-font)", color: "var(--sp-dim)" }}>Her seat is kept. Plug it in and she joins.</span>
        </span>
        <button data-bot="ledge-share" className="sp-ghost-btn" onClick={() => store.update((x) => ({ ...x, avaOnJuneau: true }))}>
          Share Juneau’s
        </button>
      </Shell>
    );
  }

  if (s.undo && s.previous) {
    const prev = game(s.previous);
    const inst = instanceOf(s.previous);
    const saved = inst?.title.split(" · ")[0] ?? prev.name;
    return (
      <Shell>
        <PeopleDots ids={["dad", "juneau", "ava"]} size={22} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", font: "600 15px/1.25 var(--sp-font)", color: "var(--sp-bone)" }}>Everyone’s in</b>
          <span style={{ display: "block", font: "500 13px/1.3 var(--sp-font)", color: "var(--sp-dim)" }}>{prev.name} saved at {saved.toLowerCase()}</span>
        </span>
        <button data-bot="ledge-undo" className="sp-ghost-btn" onClick={() => store.update(undoSwap)}>
          <TurnGlyph size={16} /> Undo swap
        </button>
      </Shell>
    );
  }
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative", zIndex: 4, background: "var(--sp-ink)", padding: "12px 14px 4px", display: "flex", alignItems: "center", gap: 12, borderRadius: "18px 18px 0 0", animation: "sp-ledge .35s cubic-bezier(.2,.8,.2,1) both", flex: "none" }}>
      {children}
    </div>
  );
}
