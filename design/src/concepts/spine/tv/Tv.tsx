// The TV: the game owns it. OGS appears only as the spine band along the bottom edge, between
// moments; when it does, the game shrinks back into a cover above the band instead of being covered.
import type { CSSProperties, ReactNode } from "react";
import type { GameManifest } from "../../../world";
import { CheckGlyph, MoonGlyph, TvGlyph } from "../glyphs";
import { game, instanceOf, personOf, seatsFor, TONIGHT } from "../session";
import { skinOf } from "../skin";
import type { S } from "../state";

const BAND = 150;

export function Tv({ s }: { s: S }) {
  return (
    <div className="sp-root" style={{ background: "var(--sp-ink)" }}>
      <Scene s={s} />
    </div>
  );
}

function Scene({ s }: { s: S }) {
  const cur = game(s.current);
  if (s.firstRun || !s.cast) return <Idle />;
  if (s.swap === "saving") {
    const inst = instanceOf(cur.id);
    return (
      <>
        <Inset g={cur} dim />
        <Band>
          <Spinner />
          <Msg big={`Saving ${cur.name}`} small={inst?.title ?? ""} />
        </Band>
      </>
    );
  }
  if (s.swap === "cutover" && s.target) return <Cutover from={cur} to={game(s.target)} />;
  if (s.swap === "following" && s.target) {
    const to = game(s.target);
    return (
      <>
        <Inset g={to} />
        <Band>
          <SeatRow g={to} s={s} following />
        </Band>
      </>
    );
  }
  if (s.tvHeld) return <Held g={cur} />;
  if (s.swap === "done") {
    return (
      <>
        <Full g={cur} />
        <Band>
          <SeatRow g={cur} s={s} />
        </Band>
      </>
    );
  }
  return <Full g={cur} />;
}

const Full = ({ g }: { g: GameManifest }) => <img src={g.art.tv} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;

/** The game, shrunk back into a cover above the band: never covered, just made room for. */
function Inset({ g, dim, style }: { g: GameManifest; dim?: boolean; style?: CSSProperties }) {
  const w = 1920 * 0.78;
  const h = 1080 * 0.78;
  return (
    <div style={{ position: "absolute", left: (1920 - w) / 2, top: (1080 - BAND - h) / 2, width: w, height: h, overflow: "hidden", borderRadius: "0 18px 18px 0", boxShadow: "0 30px 60px -20px rgba(0,0,0,.8)", animation: "sp-fade .5s both", ...style }}>
      <img src={g.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: dim ? "saturate(.7) brightness(.8)" : undefined }} />
      <span className="sp-binding" style={{ width: 22 }} />
    </div>
  );
}

function Held({ g }: { g: GameManifest }) {
  const inst = instanceOf(g.id);
  return (
    <>
      <div style={{ position: "absolute", left: (1920 - 1920 * 0.78) / 2, top: (1080 - BAND - 1080 * 0.78) / 2, width: 1920 * 0.78, height: 1080 * 0.78, overflow: "hidden", borderRadius: "0 18px 18px 0" }}>
        <img src={g.art.alt ?? g.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", animation: "sp-ken 30s ease-out both" }} />
        <span className="sp-binding" style={{ width: 22 }} />
      </div>
      <Band>
        <People ids={TONIGHT} />
        <Msg big={`${g.name} · ${inst?.title.split(" · ")[0] ?? ""}`} small="Paused on Jonathan’s phone" />
        <span style={{ marginLeft: "auto", textAlign: "right" }}>
          <span style={{ display: "block", font: "600 26px/1.2 var(--sp-font)", color: "var(--sp-dim)" }}>Later tonight</span>
          <span style={{ display: "block", font: "600 32px/1.2 var(--sp-font)", color: "var(--sp-bone)" }}>Hearthisle at 8:00</span>
        </span>
      </Band>
    </>
  );
}

function Cutover({ from, to }: { from: GameManifest; to: GameManifest }) {
  const k = skinOf(to);
  const fromInst = instanceOf(from.id);
  const toInst = instanceOf(to.id);
  return (
    <>
      <div style={{ position: "absolute", left: 90, top: 250, width: 560, height: 315, overflow: "hidden", borderRadius: "0 12px 12px 0", transform: "rotate(-4deg)", boxShadow: "0 24px 40px -16px rgba(0,0,0,.8)", animation: "sp-tv-old .9s cubic-bezier(.5,0,.2,1) both" }}>
        <img src={from.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(.75)" }} />
        <span className="sp-binding" style={{ width: 16 }} />
        <span className="sp-tag" style={{ position: "absolute", left: 16, bottom: 16, font: "600 26px/1 var(--sp-font)", padding: "10px 16px 10px 12px", gap: 10 }}>
          <CheckGlyph size={24} /> Saved · {fromInst?.title.split(" · ")[0]}
        </span>
      </div>
      <div style={{ position: "absolute", left: 730, top: 90, width: 1110, height: 624, overflow: "hidden", borderRadius: `0 ${k.radius}px ${k.radius}px 0`, boxShadow: "0 40px 80px -20px rgba(0,0,0,.85)", animation: "sp-tv-new 1s .15s cubic-bezier(.2,.8,.2,1) both" }}>
        <img src={to.art.alt ?? to.art.tv} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span className="sp-binding" style={{ width: 22 }} />
      </div>
      <Band>
        <Msg big={`${to.name} · ${toInst?.title.split(" · ")[0] ?? ""}`} small={`${from.name} is saved. Everyone’s coming along.`} />
      </Band>
    </>
  );
}

function SeatRow({ g, s, following }: { g: GameManifest; s: S; following?: boolean }) {
  const seats = seatsFor(g, instanceOf(g.id));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 56, width: "100%" }}>
      {seats.map((seat, i) => {
        const asleep = s.avaAsleep && !s.avaOnJuneau && seat.person.id === "ava";
        const shared = s.avaOnJuneau && seat.person.id === "ava";
        const arrived = !asleep && (!following || i < 2);
        return (
          <span key={seat.person.id} style={{ display: "flex", alignItems: "center", gap: 18, opacity: asleep ? 0.75 : 1 }}>
            <span style={{ position: "relative" }}>
              <People ids={[seat.person.id]} size={72} />
              <span style={{ position: "absolute", right: -6, bottom: -6, width: 34, height: 34, borderRadius: 17, background: asleep ? "var(--sp-ink2)" : arrived ? "var(--sp-bone)" : "var(--sp-ink2)", color: asleep ? "var(--sp-bone)" : "var(--sp-ink)", display: "grid", placeItems: "center", boxShadow: "0 0 0 3px var(--sp-ink)" }}>
                {asleep ? <MoonGlyph size={18} /> : arrived ? <CheckGlyph size={20} /> : <Spinner small />}
              </span>
            </span>
            <span>
              <span style={{ display: "block", font: "600 32px/1.1 var(--sp-font)", color: "var(--sp-bone)" }}>{seat.person.name}</span>
              <span style={{ display: "block", font: "500 26px/1.2 var(--sp-font)", color: "var(--sp-dim)" }}>
                {asleep ? "iPad asleep · seat kept" : shared ? `${seat.role.label} · on Juneau’s iPad` : seat.role.label}
              </span>
            </span>
          </span>
        );
      })}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, color: "var(--sp-dim)", font: "600 26px var(--sp-font)" }}>
        <TvGlyph size={32} /> Living room
      </span>
    </div>
  );
}

function Idle() {
  return (
    <Band>
      <People ids={["dad", "mom", "juneau", "ava"]} />
      <Msg big="The Mumms" small="Pick a game on a phone" />
    </Band>
  );
}

function Band({ children }: { children: ReactNode }) {
  return (
    <div className="sp-stitch-top" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAND, background: "var(--sp-ink)", display: "flex", alignItems: "center", gap: 36, padding: "10px 72px 0", animation: "sp-ledge .5s cubic-bezier(.2,.8,.2,1) both" }}>
      {children}
    </div>
  );
}

function Msg({ big, small }: { big: string; small: string }) {
  return (
    <span>
      <span style={{ display: "block", font: "700 40px/1.1 var(--sp-font)", color: "var(--sp-bone)" }}>{big}</span>
      {small && <span style={{ display: "block", font: "500 28px/1.3 var(--sp-font)", color: "var(--sp-dim)" }}>{small}</span>}
    </span>
  );
}

function People({ ids, size = 60 }: { ids: string[]; size?: number }) {
  return (
    <span style={{ display: "inline-flex" }} aria-hidden>
      {ids.map((id, i) => {
        const p = personOf(id);
        return (
          <span key={id} style={{ width: size, height: size, borderRadius: "50%", background: p.color, marginLeft: i ? -size * 0.25 : 0, boxShadow: "0 0 0 4px var(--sp-ink)", overflow: "hidden", display: "inline-block" }}>
            {p.portrait && <img src={p.portrait} alt="" style={{ width: "120%", height: "120%", objectFit: "cover", objectPosition: "50% 18%", margin: "-4% 0 0 -10%" }} />}
          </span>
        );
      })}
    </span>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const n = small ? 18 : 48;
  return <span style={{ width: n, height: n, borderRadius: "50%", border: `${small ? 3 : 5}px solid var(--sp-bone)`, borderRightColor: "transparent", animation: "sp-spin .9s linear infinite", flex: "none", display: "inline-block" }} />;
}
