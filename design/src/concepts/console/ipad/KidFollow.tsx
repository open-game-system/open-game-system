// The iPad following a switch, told with art and motion only:
// saving    — the old game folds into a little card and gets a gold check;
// cutover   — the child's own portrait hops along a dotted arc from the old card to the new one;
// following — the new game's window opens wide around the portrait. Then the game takes over.
// Taps do nothing but make the portrait bounce, so mashing can't derail anything.
import { useState } from "react";
import { gameById, type Person } from "../../../world";
import type { Switching } from "../state";
import { GameArt } from "../ui/GameArt";

export function KidFollow({ sw, who }: { sw: Switching; who: Person }) {
  const [boop, setBoop] = useState(0);
  const from = gameById(sw.from);
  const to = gameById(sw.to);
  return (
    <div className={`kid-follow kid-follow--${sw.phase}`} style={{ color: who.color, background: to.palette.ground }}>
      <div className="kid-follow__bg" style={{ background: `radial-gradient(120% 80% at 50% 100%, ${to.palette.accent2}55, transparent 60%), ${from.palette.ground}` }} />
      <div className="kid-follow__from">
        <GameArt gameId={from.id} alt />
        <span className="kid-follow__check" aria-hidden>
          <svg width="56" height="56" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3a2a00" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <svg className="kid-follow__arc" viewBox="0 0 820 1180" aria-hidden>
        <path d="M230 330 C 260 620, 560 520, 590 790" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="10" strokeLinecap="round" strokeDasharray="2 26" />
      </svg>
      <div className="kid-follow__to">
        <GameArt gameId={to.id} />
      </div>
      <button className={`kid-follow__me ${boop % 2 ? "is-boop" : ""}`} aria-label="me" onClick={() => setBoop((b) => b + 1)}>
        {who.portrait && <img src={who.portrait} alt="" />}
      </button>
    </div>
  );
}
