// "Doorway": the TV during a switch, wordless and cinematic (~3.8 s, sim.ts SWITCH_MS).
//   saving    — the old world fills the screen; a small arch of warm light opens in the middle of it
//               with the next world beyond; the old world's save ring fills in the top-left corner.
//   cutover   — the old world recedes (darker, further away) as the arch grows to a doorway; the
//               ring becomes a check; whoever is on a phone walks through first.
//   following — each kid walks through in order (their iPads show them stepping through), then the
//               arch widens until the next world is the whole screen; a small row of who's through
//               settles in the bottom-left corner. An asleep iPad's character naps by the door.
// Positions are per phase (door.ts); CSS transitions carry the motion between phases, so a shot of
// a phase is its settled frame.
import type { CSSProperties } from "react";
import { gameById } from "../../../world";
import type { Switching } from "../state";
import { Check, Moon } from "../ui/Icons";
import { ARCH, walkers, type Walker } from "./door";
import { seatViews, type SeatView } from "./Roster";
import { TvArt } from "./TvArt";

export function doorSeats(to: string, asleep: string[], phase: Switching["phase"]): SeatView[] {
  return seatViews(gameById(to), asleep, (x) => phase === "following" || (phase === "cutover" && x.device?.kind === "phone"));
}

export function TvDoor({ sw, asleep, mini = false }: { sw: Switching; asleep: string[]; mini?: boolean }) {
  const seats = doorSeats(sw.to, asleep, sw.phase);
  const a = ARCH[sw.phase];
  const door: CSSProperties = { width: a.w, height: a.h, bottom: a.b, marginLeft: -a.w / 2 };
  const beyond: CSSProperties = { bottom: -a.b };
  const saved = sw.phase !== "saving";
  return (
    <div className={`dw dw--${sw.phase} ${mini ? "dw--mini" : ""}`}>
      <div className="dw__bg" aria-hidden>
        <TvArt gameId={sw.from} />
      </div>
      <div className="dw__from" aria-hidden>
        <TvArt gameId={sw.from} />
      </div>
      <div className="dw__spill" style={{ width: a.w * 1.9, marginLeft: -a.w * 0.95 }} aria-hidden />
      <div className="dw__portal" aria-hidden>
        <div className="dw__door" style={door}>
          <div className="dw__beyond" style={beyond}>
            <TvArt gameId={sw.to} />
          </div>
          <span className="dw__shine" />
        </div>
      </div>
      <span className={`dw__saved ${saved ? "is-saved" : ""}`} aria-hidden>
        <svg className="dw__rings" viewBox="0 0 40 40" width="76" height="76">
          <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="3.4" />
          <circle className="dw__ring" cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" pathLength="100" strokeDasharray="100" transform="rotate(-90 20 20)" />
        </svg>
        {saved && <Check size={38} />}
      </span>
      <ul className="dw__walkers" aria-hidden>
        {walkers(seats, sw.phase).map((w) => (
          <WalkerView key={w.seat.person.id} w={w} />
        ))}
      </ul>
      {sw.phase === "following" && (
        <ul className="dw__in" aria-hidden>
          {seats.map((x, i) => (
            <li key={x.person.id} className={`is-${x.state}`} style={{ animationDelay: `${900 + i * 120}ms` }}>
              <img src={x.state === "asleep" && x.person.id === "ava" ? "/art/story-nook/char-dinosaur-sleep.webp" : x.person.sticker} alt="" />
              <i>{x.state === "asleep" ? <Moon size={22} /> : <Check size={22} />}</i>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WalkerView({ w }: { w: Walker }) {
  const p = w.seat.person;
  const style: CSSProperties = {
    left: w.x,
    bottom: w.y,
    opacity: w.o,
    transform: `translateX(-50%) scale(${w.k})`,
    transitionDelay: `${w.delay}ms`,
  };
  const src = w.state === "asleep" && p.id === "ava" ? "/art/story-nook/char-dinosaur-sleep.webp" : p.sticker;
  return (
    <li className={`dw__walker is-${w.state} ${w.moving ? "is-moving" : ""}`} style={style}>
      <span className="dw__shadow" />
      <img src={src} alt="" draggable={false} style={{ animationDelay: `${w.delay}ms` }} />
      {w.state === "asleep" && (
        <i className="dw__moon">
          <Moon size={34} />
        </i>
      )}
    </li>
  );
}
