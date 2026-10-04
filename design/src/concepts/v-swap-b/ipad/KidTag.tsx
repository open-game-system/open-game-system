// Whose iPad this is, without a word: the child's own sticker hangs from the top edge on a little
// tag in their colour, on every kid screen. A grown-up who picks up an iPad sees the dinosaur and
// knows it is Ava's. It is decoration, not a control: it takes no touch and opens nothing.
import type { Person } from "../../../world";

export function KidTag({ who }: { who: Person }) {
  return (
    <div className="kd-tag" style={{ color: who.color }} data-seat-tag={who.id} aria-hidden>
      <span className="kd-tag__strap" />
      <span className="kd-tag__disc">
        <img src={who.sticker} alt="" draggable={false} />
      </span>
    </div>
  );
}
