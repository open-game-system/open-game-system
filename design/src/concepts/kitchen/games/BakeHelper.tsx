// Bake Shop's littlest-helper page (stand-in): one giant bell. Mash it all you like.
import { useState } from "react";
import type { Person } from "../../../world";
import { KidBadge } from "../ipad/KidBadge";
import { Bell } from "./art";

export function BakeHelper({ kid }: { kid: Person }) {
  const [rings, setRings] = useState(0);
  return (
    <div className="g-bsh">
      <KidBadge kid={kid} />
      <button key={rings} className="g-bsh-bell" aria-label="bell" data-bot="ring-bell" onClick={() => setRings((r) => r + 1)}>
        <Bell size={460} />
      </button>
      <div className="g-bsh-dots" aria-hidden="true">
        <span /> <span /> <span />
      </div>
    </div>
  );
}
