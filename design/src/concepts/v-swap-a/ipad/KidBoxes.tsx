// Shelf swap on a kid iPad, wordless: the child's own character stands inside the open box of
// the game on the TV (its legs behind the box's front wall).
//   paused    — the box's picture pauses; the character bobs in it; the shelf of other boxes breathes.
//   saving    — the lid comes down behind the character as it climbs up onto the box's edge; the
//               next box slides off the shelf, lid on.
//   cutover   — the character leaps across into the next box; its lid pops off; the old box,
//               closed, slides back onto the shelf with a gold check.
//   following — the new box's picture opens out to fill the screen around the character.
// Taps anywhere only sparkle; mashing makes the character giggle. Nothing here changes the session.
import { useRef } from "react";
import { gameById, type Person } from "../../../world";
import { shelfOf } from "../shelf/model";
import { Spine, spineStyle } from "../shelf/Spine";
import { GameArt } from "../ui/GameArt";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";
import { MASH_SPOTS, useMash } from "./mash";

export type BoxPhase = "paused" | "saving" | "cutover" | "following";

/** Feet in the old box → up on its edge → arc → feet in the new box. */
export const LEAP_PATH = "M300 610 L300 500 C 420 40, 770 40, 880 610";
/** Where the feet are (percent of the leap path) at the end of each phase, and where they start. */
const LEG: Record<BoxPhase, { from: number; to: number; ms: number }> = {
  paused: { from: 0, to: 0, ms: 0 },
  saving: { from: 0, to: 9, ms: 900 },
  cutover: { from: 9, to: 100, ms: 1200 },
  following: { from: 100, to: 100, ms: 0 },
};

export function KidBoxes({ from, to, phase, who, mashDemo = false }: { from: string; to: string | null; phase: BoxPhase; who: Person; mashDemo?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const a = gameById(from);
  const b = to ? gameById(to) : null;
  const sparkle = [b ? b.palette.accent2 : "#fff6e0", "#fff6e0", who.color];
  const { giggle, tap } = useMash(mashDemo);
  const leg = LEG[phase];
  const shelf = shelfOf(from).filter((id) => id !== to);
  return (
    <div
      ref={host}
      className={`kbx kbx--${phase} ${giggle ? "is-giggle" : ""}`}
      style={{ color: who.color }}
      onPointerDown={(e) => {
        fire(e, host.current, "spark", sparkle);
        tap();
      }}
    >
      <div className="kbx__bg" aria-hidden>
        <GameArt gameId={b && phase !== "paused" && phase !== "saving" ? b.id : a.id} alt />
      </div>
      <div className="kbx__wall" aria-hidden />

      {/* The shelf: the other boxes, spine-out, no words. The old box joins it in the cutover. */}
      <div className="kbx-shelf" aria-hidden>
        {phase === "cutover" || phase === "following" ? (
          <span className="kbx-shelf__back">
            <Spine gameId={from} people={[who]} sticker={56} className="sp--kid" />
            <i className="kbx-shelf__check">
              <svg width="44" height="44" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </i>
          </span>
        ) : null}
        {shelf.map((id, i) => (
          <Spine key={id} gameId={id} className="sp--kid" />
        ))}
        <span className="kbx-shelf__plank" />
      </div>

      {!b && <div className="kbx-slot" aria-hidden />}
      <Box gameId={from} className="kbx-box--old" />
      {b && <Box gameId={b.id} className="kbx-box--new" />}

      <div className="kbx__leaper" style={{ offsetPath: `path("${LEAP_PATH}")`, "--from": `${leg.from}%`, "--to": `${leg.to}%`, animationName: `kbx-leg-${phase}`, animationDuration: `${leg.ms}ms` }}>
        <KidChar
          who={who}
          size={phase === "following" ? 260 : 300}
          onPoke={(e) => {
            e.stopPropagation();
            fire(e, host.current, "star", sparkle, true);
            tap();
          }}
        />
      </div>

      {/* Front walls sit over the character's legs, so it stands IN the box. */}
      <BoxFront gameId={from} className="kbx-front--old" who={who} />
      {b && <BoxFront gameId={b.id} className="kbx-front--new" who={who} />}

      {mashDemo && (
        <div className="kd-mash" aria-hidden>
          {MASH_SPOTS.map((m, i) => (
            <span key={i} className="kd-mash__tap" style={{ left: m.x, top: m.y, animationDelay: `${m.d}s` }}>
              <i style={{ borderColor: sparkle[i % sparkle.length] }} />
              {[0, 1, 2, 3, 4].map((k) => (
                <b key={k} style={{ background: sparkle[(i + k) % sparkle.length], "--a": `${k * 72 + i * 23}deg` }} />
              ))}
            </span>
          ))}
        </div>
      )}
      <Bursts bursts={bursts} />
    </div>
  );
}

function Box({ gameId, className }: { gameId: string; className: string }) {
  return (
    <div className={`kbx-box ${className}`} style={spineStyle(gameId)} aria-hidden>
      <span className="kbx-box__tray">
        <GameArt gameId={gameId} />
        <span className="kbx-box__pause">
          <svg width="56" height="56" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /></svg>
        </span>
      </span>
      <span className="kbx-box__lid">
        <GameArt gameId={gameId} alt />
      </span>
    </div>
  );
}

function BoxFront({ gameId, className, who }: { gameId: string; className: string; who: Person }) {
  return (
    <div className={`kbx-front ${className}`} style={spineStyle(gameId)} aria-hidden>
      <span className="kbx-front__stripe" />
      <span className="kbx-front__dot" style={{ background: who.color }} />
    </div>
  );
}
