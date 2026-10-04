// Kid iPads: paired once, follow the TV by name. No words anywhere; nothing here can change the TV.
import { gameById } from "../../world";
import { controlsFor, personOf, type S } from "./state";
import { Art, Sticker } from "./ui";

function TvGlyph({ lit }: { lit: boolean }) {
  return (
    <svg className="kd-tvglyph" width="120" height="96" viewBox="0 0 120 96" aria-hidden>
      {lit ? <ellipse cx="60" cy="40" rx="70" ry="50" fill="rgba(243,196,106,0.18)" /> : null}
      <rect x="10" y="8" width="100" height="64" rx="12" fill={lit ? "#f3c46a" : "none"} stroke={lit ? "#f3c46a" : "#4a4a52"} strokeWidth="6" />
      <path d="M40 88h40" stroke={lit ? "#f3c46a" : "#4a4a52"} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function Shape({ kind, color }: { kind: "circle" | "triangle" | "star"; color: string }) {
  if (kind === "circle") return <svg width="110" height="110" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="38" fill={color} /></svg>;
  if (kind === "triangle") return <svg width="120" height="110" viewBox="0 0 100 100" aria-hidden><path d="M50 10 92 86H8z" fill={color} strokeLinejoin="round" /></svg>;
  return (
    <svg width="130" height="130" viewBox="0 0 100 100" aria-hidden>
      <path d="m50 6 12.6 27.5 30 3.4-22.4 20.3 6.3 29.6L50 71.7 23.5 86.8l6.3-29.6L7.4 36.9l30-3.4z" fill={color} strokeLinejoin="round" />
    </svg>
  );
}

export function KidSurface({ s, seat }: { s: S; seat?: string }) {
  const me = personOf(seat ?? s.ipadSeat);
  const assigned = s.tonight.includes(me.id);
  const p = s.playing;

  // In a game (or paused by a dropped cast) and picked: the game's own kid controls.
  if (p && (s.tv === "game" || s.cast === "dropped" || s.cast === "connecting") && assigned && s.rosterSet) {
    const g = gameById(p.gameId);
    const pal = g.palette;
    const little = controlsFor(me.id) === "little";
    const paused = s.cast !== "live";
    return (
      <div className="kd" key={`${g.id}-${me.id}`} style={{ background: pal.ground }}>
        <Art game={g} className="kd-bg" alt />
        <div className="kd-veil" style={{ background: `linear-gradient(180deg, ${pal.ground}55 0%, ${pal.ground}cc 70%)` }} />
        <div className="kd-badge">
          <Sticker id={me.id} size={110} />
        </div>
        <div className="kd-ctl" data-bot={`kid-${me.id}`}>
          {little ? (
            <button className="giant" style={{ background: pal.accent2 }} aria-label="">
              <Shape kind="star" color={pal.ground} />
            </button>
          ) : (
            <>
              <button style={{ background: pal.accent }} aria-label="">
                <Shape kind="circle" color={pal.ground} />
              </button>
              <button style={{ background: pal.accent2 }} aria-label="">
                <Shape kind="triangle" color={pal.ground} />
              </button>
              <button style={{ background: pal.ink }} aria-label="">
                <Shape kind="star" color={pal.ground} />
              </button>
            </>
          )}
        </div>
        {paused ? (
          <div className="kd-pause">
            <svg width="200" height="200" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
              <path d="M38 30v40M62 30v40" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
            </svg>
          </div>
        ) : null}
      </div>
    );
  }

  // A game is on but this kid sits it out: the game's art, resting, nothing to press.
  if (p && s.tv === "game") {
    const g = gameById(p.gameId);
    return (
      <div className="kd" style={{ background: "#09090b" }}>
        <Art game={g} className="kd-bg" style={{ opacity: 0.35, filter: "blur(6px)" }} />
        <div className="kd-me kd-breathe">
          <Sticker id={me.id} size={300} dim />
        </div>
      </div>
    );
  }

  const tvOn = s.cast === "live";
  const lit = tvOn && s.tv === "who" && assigned;
  return (
    <div className="kd" style={{ background: tvOn ? `radial-gradient(60% 70% at 50% 55%, ${me.color}${lit ? "66" : "2a"} 0%, #09090b 75%)` : "#09090b" }}>
      <TvGlyph lit={tvOn} />
      {lit ? <div className="kd-halo" style={{ width: 560, height: 560, boxShadow: `0 0 0 14px ${me.color}, 0 0 120px ${me.color}` }} /> : null}
      <div className={`kd-me ${lit ? "kd-hop" : "kd-breathe"}`} key={lit ? "lit" : "wait"}>
        <Sticker id={me.id} size={lit ? 460 : 340} dim={!tvOn} />
      </div>
    </div>
  );
}
