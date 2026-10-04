// First run, before a grown-up pairs this iPad: nobody's yet, so there is no buddy, only the
// place one will stand. A huge empty sticker outline, dotted like the follow path, breathes in the
// dark; while the phone is pairing it ("waiting"), its dots march and halos ripple out from it, a
// buddy on the way. No character, no tag, no words. Taps do nothing; there's nothing to derail.
import type { Pairing } from "../state";
import { Mark } from "../ui/Brand";

export const isUnpaired = (pairing: Pairing | undefined): boolean => pairing !== undefined && pairing !== "paired";

/** A sticker-shaped blob (a generic buddy silhouette: head, shoulders, body), in iPad points. */
const SPOT = "M590 70c120 0 190 80 190 190 0 54-18 96-44 124 70 36 116 110 116 214v222H328V598c0-104 46-178 116-214-26-28-44-70-44-124 0-110 70-190 190-190z";

export function KidUnpaired({ pairing }: { pairing: Pairing }) {
  return (
    <div className={`bd-empty ${pairing === "waiting" ? "is-waiting" : ""}`} aria-hidden>
      <svg className="bd-empty__spot" viewBox="0 0 1180 820">
        <path d={SPOT} className="bd-empty__fill" />
        <path d={SPOT} className="bd-empty__halo bd-empty__halo--a" />
        <path d={SPOT} className="bd-empty__halo bd-empty__halo--b" />
        <path d={SPOT} className="bd-empty__dots" />
      </svg>
      <span className="bd-empty__mark">
        <Mark size={120} color="#f4f2ee" />
      </span>
    </div>
  );
}
