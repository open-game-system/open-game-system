// Following the TV to the next game, told with art: the old game folds into a small picture,
// the kid's character hops along the path to the new one, which opens up bright.
import type { CSSProperties } from "react";
import type { Person } from "../../../world";
import { gameById } from "../household";
import type { SwitchStep } from "../state";

export function Follow({ kid, from, to, step }: { kid: Person; from: string; to: string; step: SwitchStep }) {
  const a = gameById(from);
  const b = gameById(to);
  const style: CSSProperties & Record<"--kc" | "--to", string> = { "--kc": kid.color, "--to": b.palette.accent };
  return (
    <div className={`kt kt-follow kt-follow--${step}`} style={style}>
      <div className="kt-glow" />
      <div className="kt-f-from">
        <img src={a.art.tv} alt="" />
      </div>
      <svg className="kt-f-path" viewBox="0 0 820 1180" aria-hidden="true">
        <path d="M230 330C120 560 700 560 590 860" fill="none" stroke="#f6efe3" strokeWidth="14" strokeLinecap="round" strokeDasharray="2 34" opacity=".7" />
      </svg>
      <div className="kt-f-to">
        <img src={b.art.tv} alt="" />
      </div>
      <div className="kt-f-me">{kid.portrait && <img src={kid.portrait} alt="" />}</div>
    </div>
  );
}
