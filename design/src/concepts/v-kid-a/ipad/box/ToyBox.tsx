// A painted wooden toy box seen from the front, slightly from above. It is drawn in two layers so
// whatever is inside (the child's character) sits *in* it: the back layer (open lid standing up,
// the dark opening) goes under the contents, the front layer (the painted front panel, its label,
// the closed lid) over them. Render <ToyBox part="back"> and <ToyBox part="front"> with the same
// geometry. No words: the label is a sticker or a game's own art.
import type { CSSProperties, PointerEvent, ReactNode } from "react";

export interface BoxGeom {
  /** Left edge and the top of the front panel (the rim line), iPad points. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ToyBox({
  part,
  g,
  color,
  open,
  label,
  lidFace,
  className = "",
  style,
  onPointerDown,
  bot,
}: {
  part: "back" | "front";
  g: BoxGeom;
  color: string;
  open: boolean;
  /** What is stuck on the front panel (a sticker disc, a game's art card). */
  label?: ReactNode;
  /** What is painted on the inside of the open lid. */
  lidFace?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  bot?: string;
}) {
  const vars: CSSProperties = { left: g.x, top: g.y, width: g.w, height: g.h, "--tb": color, ...style };
  if (part === "back") {
    return (
      <div className={`tb-box tb-box--back ${open ? "is-open" : ""} ${className}`} style={vars} aria-hidden>
        <span className="tb-box__lidup">{lidFace && <span className="tb-box__lidface">{lidFace}</span>}</span>
        <span className="tb-box__rim" />
      </div>
    );
  }
  return (
    <div className={`tb-box tb-box--front ${open ? "is-open" : ""} ${className}`} style={vars} onPointerDown={onPointerDown} data-bot={bot} role={bot ? "button" : undefined} aria-label={bot ? "toy box" : undefined}>
      <span className="tb-box__front">
        <i className="tb-box__corner tb-box__corner--l" />
        <i className="tb-box__corner tb-box__corner--r" />
        {label && <span className="tb-box__label">{label}</span>}
      </span>
      <span className="tb-box__lid" />
    </div>
  );
}
