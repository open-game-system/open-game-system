// A kid iPad following the TV, told without words: your picture rides along a dotted thread from
// the old game's cover to a seat at the new one. Also: waiting for tonight, and asleep.
import type { CSSProperties } from "react";
import { BatteryLow, MoonGlyph, PlugGlyph, TvGlyph } from "../glyphs";
import { game, personOf } from "../session";
import { skinOf } from "../skin";
import type { S } from "../state";

function Portrait({ id, size, style }: { id: string; size: number; style?: CSSProperties }) {
  const p = personOf(id);
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: p.color, overflow: "hidden", display: "block", boxShadow: `0 0 0 10px #fffaf0, 0 0 0 18px ${p.color}, 0 24px 40px -10px rgba(0,0,0,.6)`, ...style }}>
      {p.portrait && <img src={p.portrait} alt="" style={{ width: "120%", height: "120%", objectFit: "cover", objectPosition: "50% 18%", margin: "-4% 0 0 -10%" }} />}
    </span>
  );
}

/** Swap in progress: leaving (saving), riding the thread (cutover), landing (following). */
export function Follow({ s, owner }: { s: S; owner: string }) {
  const from = game(s.current);
  const to = game(s.target ?? s.current);
  const k = skinOf(to);
  const leaving = s.swap === "saving";
  const landed = s.swap === "following";
  return (
    <div style={{ position: "absolute", inset: 0, background: leaving ? from.palette.ground : k.ground, overflow: "hidden", transition: "background .6s" }}>
      {/* the new game's cover, arriving */}
      <div style={{ position: "absolute", left: 60, right: 60, top: 70, height: 520, borderRadius: `0 ${k.radius + 10}px ${k.radius + 10}px 0`, overflow: "hidden", boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)", opacity: leaving ? 0 : 1, animation: leaving ? undefined : "sp-card-in .8s cubic-bezier(.2,.8,.2,1) both" }}>
        <img src={to.art.alt ?? to.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span className="sp-binding" style={{ width: 20 }} />
      </div>
      {/* the old cover, going back into the deck */}
      <div hidden={landed} style={{ position: "absolute", left: leaving ? 60 : 70, top: leaving ? 70 : 760, width: leaving ? 700 : 170, height: leaving ? 520 : 128, borderRadius: "0 14px 14px 0", overflow: "hidden", transform: leaving ? "none" : "rotate(-6deg)", transition: "all .8s cubic-bezier(.5,0,.2,1)", boxShadow: "0 18px 30px -12px rgba(0,0,0,.6)", opacity: leaving ? 1 : 0.9 }}>
        <img src={from.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span className="sp-binding" style={{ width: 14 }} />
      </div>
      {/* the thread */}
      {!leaving && !landed && (
        <svg width="820" height="1180" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
          <path d="M240 800 C 340 700, 440 940, 560 820" fill="none" stroke={k.dark ? "#fff6e0" : k.ink} strokeWidth="8" strokeLinecap="round" strokeDasharray="2 22" style={{ animation: "sp-march 1s linear infinite" }} />
        </svg>
      )}
      {/* the seat at the new game */}
      {landed && <span style={{ position: "absolute", left: 250, top: 640, width: 320, height: 320, borderRadius: "50%", border: `10px solid ${k.accent}`, animation: "sp-breathe 1.2s ease-in-out infinite" }} />}
      {!leaving && <span style={{ position: "absolute", left: landed ? 260 : 470, top: landed ? 930 : 900, width: landed ? 300 : 200, height: landed ? 70 : 54, borderRadius: "50%", background: k.accent2, boxShadow: "0 10px 0 rgba(0,0,0,.18)" }} />}
      <Portrait
        id={owner}
        size={leaving ? 240 : landed ? 260 : 170}
        style={{
          position: "absolute", left: leaving ? 290 : landed ? 280 : 485, top: leaving ? 700 : landed ? 670 : 740,
          animation: leaving ? "sp-breathe 1.6s ease-in-out infinite" : landed ? "sp-pop .5s both" : "sp-hop 1.4s cubic-bezier(.3,.7,.4,1) both",
        }}
      />
    </div>
  );
}

/** Paired and following tonight: the TV's game, your picture, a thread up to the TV. */
export function Waiting({ s, owner }: { s: S; owner: string }) {
  const g = game(s.current);
  const k = skinOf(g);
  return (
    <div style={{ position: "absolute", inset: 0, background: k.ground, overflow: "hidden" }}>
      <img src={g.art.alt ?? g.art.tv} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55, animation: "sp-ken 30s ease-out both" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 110, display: "grid", placeItems: "center", color: "#fff6e0" }}>
        <span style={{ width: 170, height: 170, borderRadius: 34, background: "var(--sp-ink)", display: "grid", placeItems: "center", position: "relative", boxShadow: "0 20px 40px -12px rgba(0,0,0,.6)" }}>
          <TvGlyph size={110} color="#efe7d6" />
          <span className="sp-bead" style={{ position: "absolute", top: 34, right: 30, width: 18, height: 18 }} />
        </span>
      </div>
      <svg width="820" height="1180" style={{ position: "absolute", inset: 0 }} aria-hidden>
        <path d="M410 300 L 410 600" stroke="#fff6e0" strokeWidth="9" strokeLinecap="round" strokeDasharray="2 24" style={{ animation: "sp-march 1s linear infinite" }} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 620, display: "grid", placeItems: "center" }}>
        <Portrait id={owner} size={300} style={{ animation: "sp-breathe 3s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

/** Ava's iPad: asleep at 9%. It shows only what a toddler and a grown-up both get: plug me in. */
export function Asleep({ owner }: { owner: string }) {
  const p = personOf(owner);
  const sleepy = p.portrait?.replace(/\.webp$/, "-sleep.webp");
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0a14", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", placeItems: "center", gap: 40, color: "#efe7d6", marginTop: -80 }}>
        <MoonGlyph size={90} color="#f3d98a" />
        {sleepy && <img src={sleepy} alt="" style={{ width: 380, height: 380, objectFit: "contain", opacity: 0.9 }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: 0.85 }}>
          <BatteryLow size={120} />
          <PlugGlyph size={70} color="#efe7d6" />
        </div>
      </div>
    </div>
  );
}
