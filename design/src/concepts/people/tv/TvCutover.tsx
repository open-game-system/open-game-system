// The cut-over, in one shot: the old game folds into a saved card on the left,
// the new one grows to fill the screen. Same cast, no QR, nobody touches anything.
import type { GameManifest } from "../../../world";
import { IconCheck } from "../ui/Icons";

export function TvCutover({ from, to, savedAt }: { from: GameManifest; to: GameManifest; savedAt: string }) {
  return (
    <div className="pf-cut">
      <img className="pf-cut-bg" src={to.art.tv} alt="" />
      <div className="pf-cut-old">
        <img src={from.art.tv} alt="" />
        <p>
          <IconCheck size={30} /> {from.name} · {savedAt}
        </p>
      </div>
      <div className="pf-cut-new">
        <img src={to.art.tv} alt="" />
      </div>
      <div className="pf-cut-title">
        <p className="pf-tv-kicker">Next on the couch</p>
        <h1>{to.name}</h1>
      </div>
    </div>
  );
}
