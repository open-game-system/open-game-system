// While the iPad follows a switch, the child's keepsakes wait on a wooden shelf along the wall:
// still their room, still their things, only tidied away while the boxes move. Decoration only.
import type { Person } from "../../../../world";
import { KeepsakeArt } from "./KeepsakeArt";
import { keepsakesFor } from "./keepsakes";

export function Shelf({ who }: { who: Person }) {
  const keeps = keepsakesFor(who);
  const half = Math.ceil(keeps.length / 2);
  const sides = [keeps.slice(0, half), keeps.slice(half)];
  return (
    <div className="tb-shelf" aria-hidden>
      {sides.map((side, s) => (
        <div key={s} className={`tb-shelf__side tb-shelf__side--${s ? "r" : "l"}`}>
          <span className="tb-shelf__board" />
          {side.map((k) => (
            <span key={k.id} className="tb-shelf__item">
              <KeepsakeArt k={k} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
