// The iPad following the TV through a game switch, as one continuous camera move. The glass holds
// two worlds side by side, the game being left and the next one, and pans between them while the
// child's own character waits on the window sill:
//   paused    (grown-up opened the console menu) — the old world dims with a pause mark, and the
//             TV's "Up next" shelf rises over the sill: the same tiles the TV shows, pokeable for a wish;
//   saving    — the shelf sinks, a gold check stamps the old world, the glass starts to slide;
//   cutover   — the glass is mid-pan: half the old world, half the new, a bright seam between;
//   following — the new world fills the glass and the child's own controls rise from the bottom edge
//             (the game's own kid view, its lower half), so the next screen is already in their thumbs.
// Taps anywhere only sparkle; mashing makes the character giggle (mash.ts). A wish never changes
// what plays.
import { useRef, type PointerEvent } from "react";
import type { Store } from "../../../harness/store";
import { gameById, type Person } from "../../../world";
import { GameKidView } from "../games/registry";
import { pokeThrough, seatPlan, type S } from "../state";
import { TvArt } from "../tv/TvArt";
import { Bursts, useBursts } from "./juice";
import { KidChar } from "./KidChar";
import { Shelf } from "./KidWindow";
import { MASH_SPOTS, useMash } from "./mash";
import { nextShelf } from "./window";

export type TravelPhase = "paused" | "saving" | "cutover" | "following";

export function KidTravel({ s, store, from, to, phase, who, mashDemo = false }: { s: S; store: Store<S>; from: string; to: string | null; phase: TravelPhase; who: Person; mashDemo?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { bursts, fire } = useBursts();
  const b = to ? gameById(to) : null;
  const sparkle = [b ? b.palette.accent2 : "#fff6e0", "#fff6e0", who.color];
  const { giggle, tap } = useMash(mashDemo);
  const seat = b ? seatPlan(b).find((x) => x.person.id === who.id) : undefined;
  const wish = (g: string) => (e: PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    fire(e, host.current, "star", [who.color, "#fff6e0", "#ffd23f"], true);
    store.update((x) => pokeThrough(x, who.id, g, true));
  };
  return (
    <div
      ref={host}
      className={`kp kp--${phase} ${giggle ? "is-giggle" : ""}`}
      style={{ color: who.color, background: b ? b.palette.ground : gameById(from).palette.ground }}
      onPointerDown={(e) => {
        fire(e, host.current, "spark", sparkle);
        tap();
      }}
    >
      <div className="kp__track" aria-hidden>
        <div className="kp__world kp__world--from">
          <TvArt gameId={from} />
          <span className="kp__stamp kp__stamp--pause">
            <svg width="70" height="70" viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#1b1430" /></svg>
          </span>
          <span className="kp__stamp kp__stamp--check">
            <svg width="78" height="78" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
        <span className="kp__seam" />
        <div className="kp__world kp__world--to">{b && <TvArt gameId={b.id} />}</div>
      </div>
      <div className="kp__scrim" aria-hidden />

      {phase === "paused" && <Shelf s={s} games={nextShelf(from)} focus={null} onPoke={wish} className="kp__next" />}

      <div className="kp__sill" aria-hidden={phase === "following"}>
        <span className="kw-sill__ledge" aria-hidden />
        <KidChar
          who={who}
          size={250}
          className="kw-sill__me"
          onPoke={(e) => {
            e.stopPropagation();
            fire(e, host.current, "star", sparkle, true);
            tap();
          }}
        />
      </div>

      {phase === "following" && b && seat && (
        <div className="kp__rise">
          <GameKidView gameId={b.id} who={who} role={seat.role} />
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
      <span className="kw__glass" aria-hidden />
      <Bursts bursts={bursts} />
    </div>
  );
}
