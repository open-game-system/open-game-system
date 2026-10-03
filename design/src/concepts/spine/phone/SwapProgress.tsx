// The swap, explained on the phone while it happens: the old cover goes back into the deck with
// its save, the new cover comes forward, and each device checks in by name.
import { HOME } from "../../../world";
import { CheckGlyph, TvGlyph } from "../glyphs";
import { game, instanceOf } from "../session";
import { skinOf } from "../skin";
import type { S, SwapPhase } from "../state";
import { CoverArt } from "./Cover";
import { PeopleDots } from "./Spine";

const STEP: Record<SwapPhase, number> = { none: 0, saving: 0, cutover: 1, following: 2.5, done: 4 };

export function SwapProgress({ s }: { s: S }) {
  const from = game(s.current);
  const to = game(s.target ?? s.current);
  const k = skinOf(to);
  const fromInst = instanceOf(from.id);
  const toInst = instanceOf(to.id);
  const at = STEP[s.swap];
  const kids = HOME.devices.filter((d) => d.kind === "ipad" && d.personId && ["juneau", "ava"].includes(d.personId));
  const rows: { key: string; title: string; sub: string; step: number; pid?: string; asleep?: boolean }[] = [
    { key: "save", title: `${from.name} saved`, sub: fromInst?.title ?? "Saved", step: 0 },
    { key: "tv", title: "Living room TV", sub: at >= 2 ? `Showing ${to.name}` : "Changing over", step: 1 },
    ...kids.map((d, i) => {
      const asleep = s.avaAsleep && d.personId === "ava";
      const done = at > 2 + i;
      const battery = Math.round((d.battery ?? 0) * 100);
      return {
        key: d.id, title: d.name, step: 2 + i, pid: d.personId, asleep,
        sub: asleep ? `Asleep at ${battery}% · seat kept` : done ? `In as ${seatName(to.id, d.personId ?? "")}` : "Following",
      };
    }),
  ];

  return (
    <div style={{ height: "100%", background: "var(--sp-paper)", padding: "54px 16px 0", position: "relative" }}>
      <div style={{ font: "600 15px var(--sp-font)", color: "var(--sp-ink-soft)" }}>Swapping the living room TV</div>
      <div style={{ position: "relative", height: 300, marginTop: 10 }}>
        <div style={{ position: "absolute", left: 0, top: 26, width: 128, height: 168, borderRadius: "0 10px 10px 0", overflow: "hidden", transform: "rotate(-5deg)", boxShadow: "0 10px 20px -10px rgba(0,0,0,.5)", animation: at === 0 ? "sp-card-out .9s .2s cubic-bezier(.5,0,.2,1) reverse both" : undefined }}>
          <CoverArt g={from} />
          <span className="sp-binding" />
          <span className="sp-tag" style={{ position: "absolute", left: 14, bottom: 10, fontSize: 12 }}>
            {at >= 1 ? <CheckGlyph size={14} /> : <span className="sp-bead is-wait" />}
            {at >= 1 ? "Saved" : "Saving"}
          </span>
        </div>
        <div style={{ position: "absolute", right: 0, top: 0, width: 230, height: 300, borderRadius: `0 ${Math.min(k.radius, 16)}px ${Math.min(k.radius, 16)}px 0`, overflow: "hidden", background: k.ground, boxShadow: "0 18px 30px -14px rgba(0,0,0,.55)", animation: "sp-card-in .8s cubic-bezier(.2,.8,.2,1) both" }}>
          <div style={{ height: 210 }}>
            <CoverArt g={to} alt position="50% 50%" />
          </div>
          <span className="sp-binding" />
          <div style={{ padding: "10px 12px 0 24px", color: k.onGround }}>
            <div style={{ fontFamily: k.display, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{to.name}</div>
            <div style={{ font: `600 14px/1.3 ${k.body}`, marginTop: 4 }}>{toInst?.title.split(" · ")[0] ?? to.tagline}</div>
          </div>
        </div>
      </div>

      <ol style={{ listStyle: "none", margin: "18px 0 0", padding: "4px 14px", background: "var(--sp-ink)", borderRadius: 16, color: "var(--sp-bone)" }}>
        {rows.map((r, i) => {
          const done = !r.asleep && at > r.step;
          const active = !done && !r.asleep && at >= r.step - 0.5;
          return (
            <li key={r.key} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, borderTop: i ? "1px solid rgba(239,231,214,.14)" : "none" }}>
              <span style={{ width: 30, display: "grid", placeItems: "center", flex: "none" }}>
                {r.pid ? <PeopleDots ids={[r.pid]} size={28} /> : r.key === "tv" ? <TvGlyph size={24} /> : <CoverMini id={from.id} />}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", font: "600 16px/1.2 var(--sp-font)" }}>{r.title}</span>
                <span style={{ display: "block", font: "500 13px/1.3 var(--sp-font)", color: "var(--sp-dim)" }}>{r.sub}</span>
              </span>
              <span style={{ width: 28, height: 28, borderRadius: 14, display: "grid", placeItems: "center", background: done ? "var(--sp-bone)" : "transparent", color: "var(--sp-ink)", boxShadow: done ? "none" : "inset 0 0 0 2px rgba(239,231,214,.35)" }}>
                {done ? <CheckGlyph size={16} /> : active ? <span style={{ width: 14, height: 14, borderRadius: 7, border: "2.5px solid var(--sp-bone)", borderRightColor: "transparent", animation: "sp-spin .9s linear infinite" }} /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CoverMini({ id }: { id: string }) {
  const g = game(id);
  return <span style={{ width: 22, height: 28, borderRadius: 2, background: g.art.tv ? `center/cover url(${g.art.tv})` : g.palette.ground, boxShadow: `0 0 0 1.5px ${g.palette.accent}`, display: "block" }} />;
}

function seatName(gameId: string, pid: string) {
  const g = game(gameId);
  const band = HOME.people.find((p) => p.id === pid)?.band;
  return (g.roles.find((r) => r.audience === band) ?? g.roles.find((r) => r.audience === "kid"))?.label.toLowerCase() ?? "player";
}
