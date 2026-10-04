// The iPad following the TV, told as the toy box: every game is a box.
//   paused    (grown-up opened the console menu) — the character sits in the old game's box (its
//             art painted inside the open lid, a pause sticker on the front); on the right, the
//             Up next boxes are piled up and rattle one after another, like a toy deciding;
//   saving    — the old box's lid shuts with a gold check sticker; the next game's box drops out of
//             the pile, closed; the character hops out onto the rug;
//   cutover   — the next box's lid pops open and the character hops in;
//   following — the box bursts open into the new game, which spills out to fill the screen.
// One continuous hop (path.ts-style legs on the session clock). Taps only sparkle; mashing makes the
// character giggle (mash.ts). Nothing here can change the session.
import { useRef } from "react";
import { GAMES, gameById, type GameManifest, type Person } from "../../../world";
import { GameArt } from "../ui/GameArt";
import { Room } from "./box/Room";
import { Shelf } from "./box/Shelf";
import { ToyBox, type BoxGeom } from "./box/ToyBox";
import { KidChar } from "./KidChar";
import { Bursts, useBursts } from "./juice";
import { MASH_SPOTS, useMash } from "./mash";
import { SWITCH_MS } from "../sim";

export type TravelPhase = "paused" | "saving" | "cutover" | "following";

const FROM: BoxGeom = { x: 50, y: 500, w: 440, h: 240 };
const TO: BoxGeom = { x: 690, y: 500, w: 440, h: 240 };
const CHAR = 320;
/** Feet in the old box → a hop onto the rug between the boxes → a hop into the new box. */
const HOP = `M270 566 C 300 230, 520 230, 590 700 C 650 230, 880 230, 910 566`;
const LEG: Record<TravelPhase, { from: number; to: number; ms: number }> = {
  paused: { from: 0, to: 0, ms: 0 },
  saving: { from: 0, to: 50, ms: SWITCH_MS.saving },
  cutover: { from: 50, to: 100, ms: SWITCH_MS.cutover },
  following: { from: 100, to: 100, ms: 0 },
};
/** The pile of Up next boxes while a grown-up chooses (2 × 2, bottom row first). */
const PILE: BoxGeom[] = [
  { x: 620, y: 610, w: 270, h: 170 },
  { x: 890, y: 610, w: 270, h: 170 },
  { x: 660, y: 390, w: 250, h: 150 },
  { x: 910, y: 400, w: 240, h: 140 },
];

export const boxColor = (g: GameManifest): string => `color-mix(in srgb, ${g.palette.accent} 62%, ${g.palette.ground})`;

const artCard = (id: string) => (
  <span className="tb-card">
    <GameArt gameId={id} />
  </span>
);

export function KidTravel({ from, to, phase, who, mashDemo = false }: { from: string; to: string | null; phase: TravelPhase; who: Person; mashDemo?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const a = gameById(from);
  const b = to ? gameById(to) : null;
  const sparkle = [b ? b.palette.accent2 : a.palette.accent2, "#fff6e0", who.color];
  const { giggle, tap } = useMash(mashDemo);
  const leg = LEG[phase];
  const fromShut = phase !== "paused";
  const toOpen = phase === "cutover" || phase === "following";
  const pile = GAMES.filter((g) => g.shape === "couch" && g.id !== from).slice(0, PILE.length);
  const inOld = phase === "paused";

  return (
    <div
      ref={host}
      className={`tb-travel tb-travel--${phase} ${giggle ? "is-giggle" : ""}`}
      style={{ color: who.color }}
      onPointerDown={(e) => {
        fire(e, host.current, "spark", sparkle);
        tap();
      }}
    >
      <Room dim={phase === "paused"} />
      <Shelf who={who} />

      {/* the box being left */}
      <ToyBox part="back" g={FROM} color={boxColor(a)} open={!fromShut} className="tb-from" lidFace={<GameArt gameId={from} />} />

      {/* the Up next pile, rattling while a grown-up chooses */}
      {!b &&
        pile.map((g, i) => {
          const p = PILE[i];
          if (!p) return null;
          return <ToyBox key={g.id} part="front" g={p} color={boxColor(g)} open={false} className="tb-pile" style={{ animationDelay: `${i * 0.45}s` }} label={artCard(g.id)} />;
        })}

      {/* the box we're going to */}
      {b && <ToyBox part="back" g={TO} color={boxColor(b)} open={toOpen} className="tb-to" lidFace={<GameArt gameId={b.id} />} />}

      <div
        className={`tb-hopper ${inOld ? "is-in" : ""}`}
        style={{ offsetPath: `path("${HOP}")`, "--from": `${leg.from}%`, "--to": `${leg.to}%`, animationName: `tb-leg-${phase}`, animationDuration: `${leg.ms}ms` }}
      >
        <KidChar
          who={who}
          size={CHAR}
          onPoke={(e) => {
            e.stopPropagation();
            fire(e, host.current, "star", sparkle, true);
            tap();
          }}
        />
      </div>

      <ToyBox
        part="front"
        g={FROM}
        color={boxColor(a)}
        open={!fromShut}
        className="tb-from"
        label={
          <span className="tb-card tb-card--from">
            <GameArt gameId={from} />
            <span className="tb-seal tb-seal--pause">
              <svg width="44" height="44" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /></svg>
            </span>
            <span className="tb-seal tb-seal--check">
              <svg width="48" height="48" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </span>
        }
      />
      {b && <ToyBox part="front" g={TO} color={boxColor(b)} open={toOpen} className="tb-to" label={artCard(b.id)} />}

      {/* following: the box bursts open into the game */}
      {b && phase === "following" && (
        <div className="tb-spill" style={{ background: b.palette.ground }} aria-hidden>
          <GameArt gameId={b.id} />
        </div>
      )}

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
