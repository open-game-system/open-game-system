// Bake Shop's own kid page (stand-in): the customer's dream on top, the cupcake in the middle,
// four huge ingredients at the thumbs. Tapping one frosts the cupcake.
import { useState } from "react";
import type { Person } from "../../../world";
import { gameById } from "../../../world";
import { KidBadge } from "../ipad/KidBadge";
import { Cupcake, Shaker, Swirl } from "./art";

const INGREDIENTS = [
  { id: "strawberry", color: "#f78fb0" },
  { id: "vanilla", color: "#fff3d6" },
  { id: "chocolate", color: "#8a5236" },
] as const;

export function BakeBaker({ kid }: { kid: Person }) {
  const g = gameById("bake-shop");
  const [frosting, setFrosting] = useState<string | null>(null);
  const [sprinkles, setSprinkles] = useState(false);
  return (
    <div className="g-bsk">
      <KidBadge kid={kid} />
      <div className="g-bsk-dream">
        <img className="g-bsk-bear" src={g.art.extra?.bear} alt="" />
        <div className="g-bsk-cloud">
          <Cupcake size={190} frosting="#f78fb0" sprinkles />
        </div>
      </div>
      <div className="g-bsk-counter">
        <Cupcake size={340} frosting={frosting ?? undefined} sprinkles={sprinkles} />
      </div>
      <div className="g-bsk-tray">
        {INGREDIENTS.map((i) => (
          <button key={i.id} className="g-bsk-btn" aria-label={i.id} data-bot={`bake-${i.id}`} onClick={() => setFrosting(i.color)}>
            <Swirl color={i.color} size={130} />
          </button>
        ))}
        <button className="g-bsk-btn" aria-label="sprinkles" data-bot="bake-sprinkles" onClick={() => setSprinkles(true)}>
          <Shaker size={130} />
        </button>
      </div>
    </div>
  );
}
