// First run, before a grown-up pairs this iPad: nobody's yet. No character, no tag, no words: just
// the OGS ring breathing in the dark, so it reads as "waiting" and never as "Juneau's". While the
// phone is pairing it ("waiting"), halos keep leaving the ring, the console listening for it.
// Taps do nothing; there's nothing to derail.
import type { Pairing } from "../state";
import { Mark } from "../ui/Brand";
import { TvArt } from "../tv/TvArt";

export const isUnpaired = (pairing: Pairing | undefined): boolean => pairing !== undefined && pairing !== "paired";

/** Window to the TV: before pairing the glass is frosted over the console's world; while the phone
 * pairs it, a clear circle wipes open around the ring. `world` is the console home's focused game. */
export function KidUnpaired({ pairing, world }: { pairing: Pairing; world: string }) {
  return (
    <div className={`kd-unpaired ${pairing === "waiting" ? "is-waiting" : ""}`} aria-hidden>
      <span className="kw-frost__world">
        <TvArt gameId={world} />
      </span>
      <span className="kw-frost" />
      <span className="kd-unpaired__ring">
        <i />
        <i />
        <Mark size={220} />
      </span>
    </div>
  );
}
