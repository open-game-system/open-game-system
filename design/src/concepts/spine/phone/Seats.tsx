// A cover opened from the deck: the resume point, tonight's seats (already filled from who's here,
// by age band), and the one action. Kids never pick a seat; the grown-up sees the picks here.
import type { Store } from "../../../harness/store";
import { HOME } from "../../../world";
import { ChevronLeft } from "../glyphs";
import { game, instanceOf, seatsFor, startSwap } from "../session";
import { skinOf, skinVars } from "../skin";
import type { S } from "../state";
import { Bead, CoverArt } from "./Cover";
import { statusOf } from "../covers";
import { PeopleDots } from "./Spine";

export function Seats({ s, store }: { s: S; store: Store<S> }) {
  if (!s.pick) return null;
  const g = game(s.pick);
  const k = skinOf(g);
  const inst = instanceOf(g.id);
  const seats = seatsFor(g, inst);
  const st = statusOf(g, s);
  const now = game(s.current);
  const nowInst = instanceOf(s.current);
  const deviceOf = (pid: string) => HOME.devices.find((d) => d.personId === pid && d.kind === "ipad")?.name ?? "This phone";

  return (
    <div style={{ ...skinVars(k), height: "100%", background: k.ground, color: k.onGround, position: "relative", animation: "sp-rise .36s cubic-bezier(.2,.8,.2,1) both" }}>
      <div style={{ position: "relative", height: 232 }}>
        <CoverArt g={g} alt position="50% 55%" />
        <span className="sp-binding" />
        <button data-bot="seats-close" onClick={() => store.update((x) => ({ ...x, phone: "deck", pick: undefined }))} aria-label="Back to the deck" style={{ position: "absolute", left: 22, top: 50, width: 44, height: 44, borderRadius: 22, background: "var(--sp-ink)", color: "var(--sp-bone)", display: "grid", placeItems: "center" }}>
          <ChevronLeft />
        </button>
        <span className="sp-tag" style={{ position: "absolute", left: 14, bottom: 14 }}>
          <Bead kind={st.kind} />
          {st.tag}
        </span>
      </div>
      <div style={{ padding: "14px 18px 0 22px" }}>
        <div style={{ fontFamily: k.display, fontWeight: 800, fontSize: 32, lineHeight: 1 }}>{g.name}</div>
        <div style={{ font: `700 17px/1.3 ${k.body}`, marginTop: 6 }}>Resume {inst?.title ?? g.tagline}</div>
        {inst && <div style={{ font: `500 15px/1.3 ${k.body}`, marginTop: 2 }}>{inst.detail.split(" · ").slice(1).join(" · ") || inst.detail}</div>}
      </div>

      <div style={{ margin: "14px 16px 0", background: "var(--sp-ink)", color: "var(--sp-bone)", borderRadius: 16, padding: "6px 14px" }}>
        {seats.map((seat, i) => (
          <div key={seat.person.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 50, borderTop: i ? "1px solid rgba(239,231,214,.14)" : "none" }}>
            <PeopleDots ids={[seat.person.id]} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 16px/1.2 var(--sp-font)" }}>
                {seat.person.name} <span style={{ color: "var(--sp-dim)", fontWeight: 500 }}>· {seat.role.label}</span>
              </div>
              <div style={{ font: "500 13px/1.3 var(--sp-font)", color: "var(--sp-dim)" }}>
                {deviceOf(seat.person.id)}
                {seat.lastTime ? ` · ${seat.lastTime} had this seat last time` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", left: 16, right: 16, bottom: 18 }}>
        <div style={{ font: "500 14px/1.35 var(--sp-font)", color: k.onGround, textAlign: "center", marginBottom: 10 }}>
          {now.name} saves at {(nowInst?.title.split(" · ")[0] ?? "this point").toLowerCase()}. Kids’ iPads follow on their own.
        </div>
        <button data-bot="seats-swap" className="sp-ogs-btn wide" onClick={() => store.update((x) => startSwap({ ...x, pick: undefined }, g.id))}>
          Swap the TV to {g.name}
        </button>
      </div>
    </div>
  );
}
