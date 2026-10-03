// Paired and waiting: the kid's own character on their rug, the TV above them glowing with the
// porch light, a heartbeat between them. Tapping the character just makes it hop.
import { useState, type CSSProperties } from "react";
import type { Person } from "../../../world";
import { Lamp } from "../ui/Icons";

export function Idle({ kid }: { kid: Person }) {
  const [hops, setHops] = useState(0);
  const style: CSSProperties & Record<"--kc", string> = { "--kc": kid.color };
  return (
    <div className="kt kt-idle" style={style}>
      <div className="kt-glow" />
      <div className="kt-tv" aria-hidden="true">
        <div className="kt-tv-screen">
          <Lamp size={150} />
        </div>
        <div className="kt-tv-foot" />
      </div>
      <div className="kt-beat" aria-hidden="true">
        <span /> <span /> <span />
      </div>
      <div className="kt-rug" />
      <button key={hops} className="kt-me" aria-label="me" data-bot="me" onClick={() => setHops((h) => h + 1)}>
        {kid.portrait && <img src={kid.portrait} alt="" />}
      </button>
    </div>
  );
}
