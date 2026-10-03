// Rocket Crew's own kid page (stand-in): four huge lights, colour + shape, the blinking one glows.
import { useState } from "react";
import type { Person } from "../../../world";
import { gameById } from "../../../world";
import { KidBadge } from "../ipad/KidBadge";
import { ShapeGlyph, Star, type Shape } from "./art";

const PADS: { id: string; color: string; ink: string; shape: Shape }[] = [
  { id: "white", color: "#f4f1ff", ink: "#7b6ad6", shape: "circle" },
  { id: "red", color: "#ff5a5a", ink: "#7a1020", shape: "triangle" },
  { id: "yellow", color: "#ffd23f", ink: "#8a5a00", shape: "star" },
  { id: "blue", color: "#5fb8ff", ink: "#0f3d6e", shape: "square" },
];

export function RocketFixer({ kid }: { kid: Person }) {
  const g = gameById("rocket-crew");
  const [hit, setHit] = useState<string | null>(null);
  return (
    <div className="g-rcf" style={{ backgroundImage: `url(${g.art.tv})` }}>
      <div className="g-rcf-veil" />
      <KidBadge kid={kid} />
      <div className="g-rcf-stars">
        <Star filled size={64} />
        <Star filled size={64} />
        <Star filled={false} size={64} />
      </div>
      <div className="g-rcf-pads">
        {PADS.map((p) => (
          <button
            key={p.id}
            aria-label={p.id}
            data-bot={`fix-${p.id}`}
            className={`g-rcf-pad${p.id === "yellow" ? " g-rcf-pad--blink" : ""}${hit === p.id ? " g-rcf-pad--hit" : ""}`}
            style={{ background: p.color }}
            onClick={() => setHit(p.id)}
          >
            <ShapeGlyph shape={p.shape} size={150} color={p.ink} />
          </button>
        ))}
      </div>
    </div>
  );
}
