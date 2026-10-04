// First run, before a grown-up pairs this iPad: nobody's yet. An empty, unpainted toy box sits shut
// in a grey room, with a blank dashed spot on its front where a child's sticker will go. While the
// phone is pairing it ("waiting"), the lid rattles and a warm glow wakes up behind it: someone is
// about to move in. No character, no tag, no words. Taps do nothing; there's nothing to derail.
import type { Pairing } from "../state";
import { Room } from "./box/Room";
import { ToyBox, type BoxGeom } from "./box/ToyBox";

export const isUnpaired = (pairing: Pairing | undefined): boolean => pairing !== undefined && pairing !== "paired";

const BOX: BoxGeom = { x: 360, y: 560, w: 460, h: 240 };

export function KidUnpaired({ pairing }: { pairing: Pairing }) {
  return (
    <div className={`tb-unpaired ${pairing === "waiting" ? "is-waiting" : ""}`} aria-hidden>
      <Room />
      <span className="tb-glow" />
      <ToyBox part="front" g={BOX} color="#9a7656" open={false} label={<span className="tb-blank" />} />
    </div>
  );
}
